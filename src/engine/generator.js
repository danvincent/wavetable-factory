'use strict';

const {
  generateSine,
  generateSawtooth,
  generateSquare,
  generateTriangle,
  generatePulse,
  additiveWave,
  generateFilteredNoise,
  generateWavefold,
  generateFM,
  generateSupersaw,
  normalize,
} = require('./waveforms');

/**
 * Build harmonic amplitude array for a given waveform type and complexity.
 * complexity 1 = fundamental only; 10 = rich harmonic content.
 * @param {string} type
 * @param {number} complexity - 1–10
 * @returns {number[]}
 */
function buildHarmonics(type, complexity) {
  // Scale harmonic count: complexity 1 = 1 harmonic, 10 = 16 harmonics
  const count = Math.round(1 + (complexity - 1) * (15 / 9));
  const harmonics = [];
  for (let h = 1; h <= count; h++) {
    switch (type) {
      case 'sawtooth':
        harmonics.push(1 / h); // classic sawtooth: all harmonics, 1/n
        break;
      case 'square':
        harmonics.push(h % 2 === 1 ? 1 / h : 0); // odd harmonics only
        break;
      case 'triangle':
        harmonics.push(h % 2 === 1 ? Math.pow(-1, (h - 1) / 2) / (h * h) : 0);
        break;
      default:
        harmonics.push(h === 1 ? 1 : 0); // sine: fundamental only
    }
  }
  return harmonics;
}

/**
 * Generate a single frame using the specified waveform type and complexity.
 * @param {string} type
 * @param {number} samplesPerFrame
 * @param {number} complexity - 1–10
 * @param {number} [harmonicShift=0] - phase shift on harmonic weights (0–1), used for morphing
 * @returns {Float32Array}
 */
function generateFrame(type, samplesPerFrame, complexity, harmonicShift = 0) {
  if (type === 'sine' && complexity <= 1) return generateSine(samplesPerFrame);
  if (type === 'sawtooth' && complexity <= 1) return generateSawtooth(samplesPerFrame);
  if (type === 'square' && complexity <= 1) return generateSquare(samplesPerFrame);
  if (type === 'triangle' && complexity <= 1) return generateTriangle(samplesPerFrame);
  if (type === 'pulse') return generatePulse(samplesPerFrame);

  // New generator types — parameters scale with complexity and harmonicShift (0–1 morph position)
  if (type === 'noise') {
    // passes: complexity 1 = 4 (smooth), complexity 10 = 0 (raw white noise)
    const passes = Math.round(4 - harmonicShift * 4 * (complexity / 10));
    return generateFilteredNoise(samplesPerFrame, Math.max(0, passes));
  }

  if (type === 'wavefold') {
    // drive: 1.5 at low complexity, up to 6.0 at high; morphs from subtle to aggressive
    const drive = 1.5 + harmonicShift * (1 + complexity * 0.5);
    return generateWavefold(samplesPerFrame, Math.min(drive, 7.0));
  }

  if (type === 'fm') {
    // ratio and index both scale with complexity and shift
    const ratio = 1 + Math.round(harmonicShift * complexity);
    const index = 0.5 + harmonicShift * complexity * 0.8;
    return generateFM(samplesPerFrame, Math.max(1, ratio), Math.min(index, 10));
  }

  if (type === 'supersaw') {
    // spread widens with complexity; voice count grows with shift
    const count = 3 + Math.round(harmonicShift * Math.min(complexity, 7));
    const spread = 0.1 + harmonicShift * (complexity / 10) * 0.5;
    return generateSupersaw(samplesPerFrame, count, spread);
  }

  // For additive and complex versions of basic types, use additive synthesis
  const harmonics = buildHarmonics(type === 'additive' ? 'sawtooth' : type, complexity);
  // Apply harmonic shift by rotating amplitudes — creates morphing effect
  if (harmonicShift > 0 && harmonics.length > 1) {
    const shift = harmonicShift * (complexity / 10);
    for (let h = 0; h < harmonics.length; h++) {
      harmonics[h] *= (1 - shift) + shift * Math.sin(Math.PI * h / harmonics.length);
    }
  }
  return additiveWave(harmonics, samplesPerFrame);
}

/**
 * Linearly interpolate between two frames, producing `steps` output frames.
 * First output frame = frameA, last output frame = frameB.
 * @param {Float32Array} frameA
 * @param {Float32Array} frameB
 * @param {number} steps
 * @returns {Float32Array[]}
 */
function morphFrames(frameA, frameB, steps) {
  const result = [];
  for (let s = 0; s < steps; s++) {
    const t = steps === 1 ? 0 : s / (steps - 1);
    const frame = new Float32Array(frameA.length);
    for (let i = 0; i < frameA.length; i++) {
      frame[i] = frameA[i] * (1 - t) + frameB[i] * t;
    }
    result.push(frame);
  }
  return result;
}

/**
 * Generate a complete wavetable as an array of frames.
 * complexity=1: all frames identical (pure waveform).
 * complexity>1: frames morph through harmonic variations.
 *
 * @param {object} options
 * @param {string} options.type - waveform type
 * @param {number} options.frameCount - number of frames
 * @param {number} options.samplesPerFrame - samples per frame
 * @param {number} options.complexity - 1–10
 * @returns {Float32Array[]}
 */
function generateWavetable({ type, frameCount, samplesPerFrame, complexity }) {
  if (complexity <= 1) {
    // Pure waveform — all frames identical
    const baseFrame = generateFrame(type, samplesPerFrame, complexity, 0);
    return Array.from({ length: frameCount }, () => new Float32Array(baseFrame));
  }

  // Build morph waypoints: number scales with complexity
  const waypointCount = Math.max(2, Math.round(2 + (complexity - 1) * (6 / 9)));
  const waypoints = [];
  for (let w = 0; w < waypointCount; w++) {
    const shift = (w / (waypointCount - 1));
    waypoints.push(generateFrame(type, samplesPerFrame, complexity, shift));
  }

  // Distribute frames across morph segments
  const frames = [];
  const segmentSize = (frameCount - 1) / (waypointCount - 1);
  for (let w = 0; w < waypointCount - 1; w++) {
    const stepsInSegment = Math.round(
      w === waypointCount - 2
        ? frameCount - frames.length
        : segmentSize
    );
    const morphed = morphFrames(waypoints[w], waypoints[w + 1], stepsInSegment);
    // Avoid duplicate boundary frames between segments
    if (w > 0) morphed.shift();
    frames.push(...morphed);
  }

  // Ensure exact frameCount (rounding may cause ±1)
  while (frames.length < frameCount) frames.push(new Float32Array(waypoints[waypoints.length - 1]));
  return frames.slice(0, frameCount);
}

module.exports = { generateWavetable, morphFrames, generateFrame, buildHarmonics };

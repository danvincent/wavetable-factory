'use strict';

const { WAVEFORM_TYPES, ABLETON, COMPLEXITY_MIN, COMPLEXITY_MAX } = require('../constants');
const { generateWavetable, morphFrames } = require('./generator');
const { additiveWave } = require('./waveforms');

/**
 * Pick a random element from an array.
 * @param {Array} arr
 * @returns {*}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random array of harmonic amplitudes scaled by complexity.
 * complexity 1 → 1 harmonic; complexity 10 → 16 harmonics with random weights.
 * @param {number} complexity - 1–10
 * @returns {number[]}
 */
function randomHarmonics(complexity) {
  const count = Math.round(1 + (complexity - 1) * (15 / 9));
  const harmonics = [];
  for (let h = 0; h < count; h++) {
    // Fundamental always strong; higher harmonics get less amplitude on average
    const baseAmp = h === 0 ? 1 : Math.random() * (1 / (h + 1));
    // Scale randomness: low complexity keeps fundamental dominant
    const scaled = h === 0 ? 1 : baseAmp * (complexity / COMPLEXITY_MAX);
    harmonics.push(Math.max(0, Math.min(1, scaled)));
  }
  return harmonics;
}

/**
 * Generate randomized wavetable options based on complexity.
 * @param {number} complexity - 1–10
 * @returns {{ type, harmonics, complexity, morphTargets }}
 */
function randomizeOptions(complexity) {
  const type = pick(WAVEFORM_TYPES);

  const morphTargetCount = Math.max(1, Math.round((complexity / COMPLEXITY_MAX) * 4));
  const morphTargets = Array.from({ length: morphTargetCount }, () => pick(WAVEFORM_TYPES));

  return {
    type,
    harmonics: randomHarmonics(complexity),
    complexity,
    morphTargets,
  };
}

/**
 * Generate a completely random wavetable using random waveform blending and morphing.
 * Each call produces a unique result.
 *
 * @param {number} complexity - 1–10
 * @param {number} frameCount - number of output frames
 * @param {number} [samplesPerFrame] - defaults to Ableton spec (2048)
 * @returns {Float32Array[]}
 */
function generateRandomWavetable(complexity, frameCount, samplesPerFrame = ABLETON.samplesPerFrame) {
  const opts = randomizeOptions(complexity);

  // Build morph waypoints from random morph targets
  const targets = [opts.type, ...opts.morphTargets];
  const waypoints = targets.map(type =>
    additiveWave(randomHarmonics(complexity), samplesPerFrame)
  );

  if (waypoints.length === 1 || frameCount === 1) {
    return Array.from({ length: frameCount }, () => new Float32Array(waypoints[0]));
  }

  // Distribute frames across morph segments between waypoints
  const frames = [];
  const segmentSize = (frameCount - 1) / (waypoints.length - 1);

  for (let w = 0; w < waypoints.length - 1; w++) {
    const isLast = w === waypoints.length - 2;
    const stepsInSegment = isLast
      ? frameCount - frames.length
      : Math.round(segmentSize);

    const morphed = morphFrames(waypoints[w], waypoints[w + 1], stepsInSegment);
    if (w > 0) morphed.shift(); // avoid duplicate boundary frames
    frames.push(...morphed);
  }

  while (frames.length < frameCount) {
    frames.push(new Float32Array(waypoints[waypoints.length - 1]));
  }
  return frames.slice(0, frameCount);
}

module.exports = { randomizeOptions, generateRandomWavetable, randomHarmonics };

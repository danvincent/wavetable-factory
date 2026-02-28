'use strict';

const TWO_PI = 2 * Math.PI;

/**
 * Generate one cycle of a sine wave.
 * @param {number} length - Number of samples
 * @returns {Float32Array}
 */
function generateSine(length) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin(TWO_PI * i / length);
  }
  return samples;
}

/**
 * Generate one cycle of a sawtooth wave (rises from -1 to just below 1).
 * @param {number} length
 * @returns {Float32Array}
 */
function generateSawtooth(length) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = 2 * (i / length) - 1;
  }
  return samples;
}

/**
 * Generate one cycle of a square wave.
 * @param {number} length
 * @param {number} dutyCycle - 0.0–1.0, fraction of period that is high (default 0.5)
 * @returns {Float32Array}
 */
function generateSquare(length, dutyCycle = 0.5) {
  const samples = new Float32Array(length);
  const threshold = Math.round(length * dutyCycle);
  for (let i = 0; i < length; i++) {
    samples[i] = i < threshold ? 1 : -1;
  }
  return samples;
}

/**
 * Generate one cycle of a triangle wave.
 * @param {number} length
 * @returns {Float32Array}
 */
function generateTriangle(length) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    samples[i] = 1 - 4 * Math.abs(Math.round(t - 0.25) - (t - 0.25));
  }
  return samples;
}

/**
 * Generate one cycle of a narrow pulse wave.
 * @param {number} length
 * @param {number} width - Pulse width as fraction of period (default 0.1)
 * @returns {Float32Array}
 */
function generatePulse(length, width = 0.1) {
  return generateSquare(length, width);
}

/**
 * Generate an additive synthesis wave from an array of harmonic amplitudes.
 * harmonics[0] = fundamental amplitude, harmonics[1] = 2nd harmonic, etc.
 * Result is normalized to [-1, 1].
 * @param {number[]} harmonics
 * @param {number} length
 * @returns {Float32Array}
 */
function additiveWave(harmonics, length) {
  const samples = new Float32Array(length);
  for (let h = 0; h < harmonics.length; h++) {
    const amp = harmonics[h];
    if (amp === 0) continue;
    const harmonicNum = h + 1;
    for (let i = 0; i < length; i++) {
      samples[i] += amp * Math.sin(TWO_PI * harmonicNum * i / length);
    }
  }
  return normalize(samples);
}

/**
 * Normalize a Float32Array so its peak absolute value is 1.
 * Returns silence unchanged if peak is 0.
 * @param {Float32Array} samples
 * @returns {Float32Array}
 */
function normalize(samples) {
  let peak = 0;
  for (const s of samples) {
    const abs = Math.abs(s);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] / peak;
  }
  return out;
}

/**
 * Smoothed white noise — one loopable cycle.
 * passes controls how many rounds of circular averaging are applied:
 * 1 = grainy/gritty, 5 = silky smooth.
 * @param {number} length
 * @param {number} passes - smoothing iterations (default 2)
 * @returns {Float32Array}
 */
function generateFilteredNoise(length, passes = 2) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const prev = (i - 1 + length) % length;
      const next = (i + 1) % length;
      tmp[i] = (samples[prev] + samples[i] + samples[next]) / 3;
    }
    samples.set(tmp);
  }
  return normalize(samples);
}

/**
 * Wavefolder — sine folded back on itself to add harmonics.
 * drive 1.5 = subtle, 6.0 = aggressive.
 * @param {number} length
 * @param {number} drive - fold intensity (default 3.0)
 * @returns {Float32Array}
 */
function generateWavefold(length, drive = 3.0) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = Math.sin(TWO_PI * i / length) * drive;
    // Reflect v into [-1, 1] using triangle-wave folding
    v = v - 2 * Math.floor((v + 1) / 2);
    if (v < -1) v = -2 - v;
    samples[i] = v;
  }
  return normalize(samples);
}

/**
 * FM synthesis — one modulator shaping one carrier.
 * @param {number} length
 * @param {number} ratio  - modulator:carrier frequency ratio (default 2)
 * @param {number} index  - modulation index / depth (default 3)
 * @returns {Float32Array}
 */
function generateFM(length, ratio = 2, index = 3) {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const mod = index * Math.sin(TWO_PI * ratio * i / length);
    samples[i] = Math.sin(TWO_PI * i / length + mod);
  }
  return normalize(samples);
}

/**
 * Supersaw — multiple phase-offset sawtooth waves summed.
 * @param {number} length
 * @param {number} count  - number of saw voices (default 5)
 * @param {number} spread - phase spread per voice 0–1 (default 0.25)
 * @returns {Float32Array}
 */
function generateSupersaw(length, count = 5, spread = 0.25) {
  const samples = new Float32Array(length);
  for (let v = 0; v < count; v++) {
    const offset = count === 1 ? 0 : (v / (count - 1) - 0.5) * spread;
    for (let i = 0; i < length; i++) {
      const phase = ((i / length) + offset + 1) % 1;
      samples[i] += 2 * phase - 1;
    }
  }
  return normalize(samples);
}

module.exports = {
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
};

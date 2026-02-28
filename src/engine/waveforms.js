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

module.exports = {
  generateSine,
  generateSawtooth,
  generateSquare,
  generateTriangle,
  generatePulse,
  additiveWave,
  normalize,
};

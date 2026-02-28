'use strict';

// Tests for src/engine/waveforms.js

const {
  generateSine,
  generateSawtooth,
  generateSquare,
  generateTriangle,
  generatePulse,
  additiveWave,
  normalize,
} = require('../../src/engine/waveforms');

const LENGTH = 512;
const EPSILON = 1e-6;

describe('generateSine(length)', () => {
  test('returns Float32Array of correct length', () => {
    const samples = generateSine(LENGTH);
    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples.length).toBe(LENGTH);
  });

  test('all values in [-1, 1]', () => {
    const samples = generateSine(LENGTH);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
      expect(s).toBeLessThanOrEqual(1 + EPSILON);
    }
  });

  test('first sample is near 0', () => {
    const samples = generateSine(LENGTH);
    expect(Math.abs(samples[0])).toBeLessThan(EPSILON);
  });

  test('quarter-period sample is near 1', () => {
    const samples = generateSine(LENGTH);
    expect(Math.abs(samples[LENGTH / 4] - 1)).toBeLessThan(0.01);
  });
});

describe('generateSawtooth(length)', () => {
  test('returns Float32Array of correct length', () => {
    expect(generateSawtooth(LENGTH)).toHaveLength(LENGTH);
  });

  test('all values in [-1, 1]', () => {
    const samples = generateSawtooth(LENGTH);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
      expect(s).toBeLessThanOrEqual(1 + EPSILON);
    }
  });

  test('rises from -1 to just below 1', () => {
    const samples = generateSawtooth(LENGTH);
    expect(samples[0]).toBeCloseTo(-1, 3);
    expect(samples[LENGTH - 1]).toBeLessThan(1);
    expect(samples[LENGTH - 1]).toBeGreaterThan(0.99);
  });
});

describe('generateSquare(length, dutyCycle)', () => {
  test('returns Float32Array of correct length', () => {
    expect(generateSquare(LENGTH)).toHaveLength(LENGTH);
  });

  test('default 50% duty cycle produces equal positive and negative regions', () => {
    const samples = generateSquare(LENGTH);
    const positives = Array.from(samples).filter(s => s > 0).length;
    expect(positives).toBe(LENGTH / 2);
  });

  test('values are exactly 1 or -1', () => {
    const samples = generateSquare(LENGTH);
    for (const s of samples) {
      expect(Math.abs(Math.abs(s) - 1)).toBeLessThan(EPSILON);
    }
  });

  test('25% duty cycle has correct proportion of positive samples', () => {
    const samples = generateSquare(LENGTH, 0.25);
    const positives = Array.from(samples).filter(s => s > 0).length;
    expect(positives).toBe(LENGTH * 0.25);
  });
});

describe('generateTriangle(length)', () => {
  test('returns Float32Array of correct length', () => {
    expect(generateTriangle(LENGTH)).toHaveLength(LENGTH);
  });

  test('all values in [-1, 1]', () => {
    const samples = generateTriangle(LENGTH);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
      expect(s).toBeLessThanOrEqual(1 + EPSILON);
    }
  });

  test('peak at quarter period is near 1', () => {
    const samples = generateTriangle(LENGTH);
    expect(samples[LENGTH / 4]).toBeCloseTo(1, 2);
  });

  test('trough at three-quarter period is near -1', () => {
    const samples = generateTriangle(LENGTH);
    expect(samples[(3 * LENGTH) / 4]).toBeCloseTo(-1, 2);
  });
});

describe('generatePulse(length, width)', () => {
  test('returns Float32Array of correct length', () => {
    expect(generatePulse(LENGTH)).toHaveLength(LENGTH);
  });

  test('default narrow pulse has small proportion of positive samples', () => {
    const samples = generatePulse(LENGTH, 0.1);
    const positives = Array.from(samples).filter(s => s > 0).length;
    expect(positives).toBe(Math.round(LENGTH * 0.1));
  });

  test('values are exactly 1 or -1', () => {
    const samples = generatePulse(LENGTH, 0.2);
    for (const s of samples) {
      expect(Math.abs(Math.abs(s) - 1)).toBeLessThan(EPSILON);
    }
  });
});

describe('additiveWave(harmonics, length)', () => {
  test('returns Float32Array of correct length', () => {
    const samples = additiveWave([1, 0.5, 0.25], LENGTH);
    expect(samples).toHaveLength(LENGTH);
  });

  test('all values in [-1, 1] after normalization', () => {
    const samples = additiveWave([1, 0.8, 0.6, 0.4], LENGTH);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
      expect(s).toBeLessThanOrEqual(1 + EPSILON);
    }
  });

  test('single harmonic matches sine wave', () => {
    const additive = additiveWave([1], LENGTH);
    const sine = generateSine(LENGTH);
    for (let i = 0; i < LENGTH; i++) {
      expect(Math.abs(additive[i] - sine[i])).toBeLessThan(EPSILON);
    }
  });

  test('zero harmonics array returns silence', () => {
    const samples = additiveWave([0, 0, 0], LENGTH);
    for (const s of samples) {
      expect(Math.abs(s)).toBeLessThan(EPSILON);
    }
  });
});

describe('normalize(samples)', () => {
  test('scales samples so peak is 1', () => {
    const input = new Float32Array([0.1, 0.2, 0.5, 0.3]);
    const output = normalize(input);
    expect(Math.max(...output)).toBeCloseTo(1, 5);
  });

  test('preserves sign of samples', () => {
    const input = new Float32Array([-0.5, 0.5]);
    const output = normalize(input);
    expect(output[0]).toBeCloseTo(-1, 5);
    expect(output[1]).toBeCloseTo(1, 5);
  });

  test('returns silence array unchanged if peak is 0', () => {
    const input = new Float32Array([0, 0, 0]);
    const output = normalize(input);
    for (const s of output) expect(s).toBe(0);
  });
});

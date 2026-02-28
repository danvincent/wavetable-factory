'use strict';

const { WAVEFORM_TYPES, COMPLEXITY_MIN, COMPLEXITY_MAX } = require('../../src/constants');
const { randomizeOptions, generateRandomWavetable } = require('../../src/engine/randomizer');

const EPSILON = 1e-6;

describe('randomizeOptions(complexity)', () => {
  test('returns an object with required fields', () => {
    const opts = randomizeOptions(5);
    expect(opts).toHaveProperty('type');
    expect(opts).toHaveProperty('harmonics');
    expect(opts).toHaveProperty('complexity');
    expect(opts).toHaveProperty('morphTargets');
  });

  test('type is a valid waveform type', () => {
    for (let i = 0; i < 20; i++) {
      const opts = randomizeOptions(5);
      expect(WAVEFORM_TYPES).toContain(opts.type);
    }
  });

  test('complexity is passed through unchanged', () => {
    expect(randomizeOptions(3).complexity).toBe(3);
    expect(randomizeOptions(9).complexity).toBe(9);
  });

  test('harmonics is an array with length proportional to complexity', () => {
    const low = randomizeOptions(COMPLEXITY_MIN);
    const high = randomizeOptions(COMPLEXITY_MAX);
    expect(Array.isArray(low.harmonics)).toBe(true);
    expect(Array.isArray(high.harmonics)).toBe(true);
    expect(high.harmonics.length).toBeGreaterThan(low.harmonics.length);
  });

  test('harmonic amplitudes are all in [0, 1]', () => {
    for (let c = 1; c <= 10; c++) {
      const opts = randomizeOptions(c);
      for (const amp of opts.harmonics) {
        expect(amp).toBeGreaterThanOrEqual(0);
        expect(amp).toBeLessThanOrEqual(1);
      }
    }
  });

  test('morphTargets is an array of valid waveform types', () => {
    const opts = randomizeOptions(8);
    expect(Array.isArray(opts.morphTargets)).toBe(true);
    for (const t of opts.morphTargets) {
      expect(WAVEFORM_TYPES).toContain(t);
    }
  });

  test('higher complexity produces more morph targets', () => {
    const low = randomizeOptions(1);
    const high = randomizeOptions(10);
    expect(high.morphTargets.length).toBeGreaterThanOrEqual(low.morphTargets.length);
  });

  test('produces different results on successive calls (randomness)', () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(randomizeOptions(8).type + JSON.stringify(randomizeOptions(8).harmonics));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('generateRandomWavetable(complexity, frameCount)', () => {
  test('returns array of correct frame count', () => {
    const frames = generateRandomWavetable(5, 16);
    expect(frames).toHaveLength(16);
  });

  test('each frame is a Float32Array', () => {
    const frames = generateRandomWavetable(5, 8);
    for (const frame of frames) {
      expect(frame).toBeInstanceOf(Float32Array);
    }
  });

  test('all sample values are in [-1, 1]', () => {
    const frames = generateRandomWavetable(7, 8);
    for (const frame of frames) {
      for (const s of frame) {
        expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
        expect(s).toBeLessThanOrEqual(1 + EPSILON);
      }
    }
  });

  test('uses Ableton samplesPerFrame (2048) by default', () => {
    const frames = generateRandomWavetable(5, 4);
    for (const frame of frames) {
      expect(frame.length).toBe(2048);
    }
  });

  test('complexity 10 produces frames that differ across the table', () => {
    const frames = generateRandomWavetable(10, 16);
    const allSame = frames.every(f =>
      f.every((s, i) => Math.abs(s - frames[0][i]) < 0.01)
    );
    expect(allSame).toBe(false);
  });

  test('works across all complexity levels without throwing', () => {
    for (let c = COMPLEXITY_MIN; c <= COMPLEXITY_MAX; c++) {
      expect(() => generateRandomWavetable(c, 8)).not.toThrow();
    }
  });

  test('successive calls produce different wavetables', () => {
    const a = generateRandomWavetable(8, 4);
    const b = generateRandomWavetable(8, 4);
    const identical = a.every((frame, fi) =>
      frame.every((s, si) => Math.abs(s - b[fi][si]) < EPSILON)
    );
    expect(identical).toBe(false);
  });
});

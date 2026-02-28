'use strict';

const { generateWavetable, morphFrames } = require('../../src/engine/generator');

const EPSILON = 1e-6;

describe('morphFrames(frameA, frameB, steps)', () => {
  const frameA = new Float32Array([1, 1, 1, 1]);
  const frameB = new Float32Array([-1, -1, -1, -1]);

  test('returns array of correct step count', () => {
    const result = morphFrames(frameA, frameB, 4);
    expect(result).toHaveLength(4);
  });

  test('each frame is a Float32Array of same length as inputs', () => {
    const result = morphFrames(frameA, frameB, 4);
    for (const frame of result) {
      expect(frame).toBeInstanceOf(Float32Array);
      expect(frame.length).toBe(frameA.length);
    }
  });

  test('first frame equals frameA', () => {
    const result = morphFrames(frameA, frameB, 4);
    for (let i = 0; i < frameA.length; i++) {
      expect(result[0][i]).toBeCloseTo(frameA[i], 5);
    }
  });

  test('last frame equals frameB', () => {
    const result = morphFrames(frameA, frameB, 4);
    const last = result[result.length - 1];
    for (let i = 0; i < frameB.length; i++) {
      expect(last[i]).toBeCloseTo(frameB[i], 5);
    }
  });

  test('midpoint frame is average of frameA and frameB', () => {
    const result = morphFrames(frameA, frameB, 3);
    // step 0 = frameA, step 1 = midpoint, step 2 = frameB
    for (let i = 0; i < frameA.length; i++) {
      expect(result[1][i]).toBeCloseTo(0, 5);
    }
  });

  test('single step returns only frameA', () => {
    const result = morphFrames(frameA, frameB, 1);
    expect(result).toHaveLength(1);
    for (let i = 0; i < frameA.length; i++) {
      expect(result[0][i]).toBeCloseTo(frameA[i], 5);
    }
  });
});

describe('generateWavetable(options)', () => {
  test('returns array of frames with correct frameCount', () => {
    const frames = generateWavetable({ type: 'sine', frameCount: 8, samplesPerFrame: 256, complexity: 1 });
    expect(frames).toHaveLength(8);
  });

  test('each frame has correct samplesPerFrame length', () => {
    const frames = generateWavetable({ type: 'sine', frameCount: 8, samplesPerFrame: 256, complexity: 1 });
    for (const frame of frames) {
      expect(frame).toHaveLength(256);
    }
  });

  test('each frame is a Float32Array', () => {
    const frames = generateWavetable({ type: 'sawtooth', frameCount: 4, samplesPerFrame: 128, complexity: 1 });
    for (const frame of frames) {
      expect(frame).toBeInstanceOf(Float32Array);
    }
  });

  test('all sample values are in [-1, 1]', () => {
    const frames = generateWavetable({ type: 'square', frameCount: 8, samplesPerFrame: 256, complexity: 5 });
    for (const frame of frames) {
      for (const s of frame) {
        expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
        expect(s).toBeLessThanOrEqual(1 + EPSILON);
      }
    }
  });

  test('single frame wavetable still returns array of one', () => {
    const frames = generateWavetable({ type: 'triangle', frameCount: 1, samplesPerFrame: 256, complexity: 3 });
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(256);
  });

  test('additive type produces valid output across complexity range', () => {
    for (const complexity of [1, 5, 10]) {
      const frames = generateWavetable({ type: 'additive', frameCount: 4, samplesPerFrame: 256, complexity });
      expect(frames).toHaveLength(4);
      for (const frame of frames) {
        for (const s of frame) {
          expect(s).toBeGreaterThanOrEqual(-1 - EPSILON);
          expect(s).toBeLessThanOrEqual(1 + EPSILON);
        }
      }
    }
  });

  test('higher complexity introduces morphing across frames', () => {
    const lowComplexity = generateWavetable({ type: 'sine', frameCount: 16, samplesPerFrame: 256, complexity: 1 });
    const highComplexity = generateWavetable({ type: 'sine', frameCount: 16, samplesPerFrame: 256, complexity: 10 });
    // With low complexity all frames are identical sine, high complexity frames differ
    const lowAllSame = lowComplexity.every(f =>
      f.every((s, i) => Math.abs(s - lowComplexity[0][i]) < 0.01)
    );
    const highAllSame = highComplexity.every(f =>
      f.every((s, i) => Math.abs(s - highComplexity[0][i]) < 0.01)
    );
    expect(lowAllSame).toBe(true);
    expect(highAllSame).toBe(false);
  });

  test('all supported waveform types generate without error', () => {
    const types = ['sine', 'sawtooth', 'square', 'triangle', 'pulse', 'additive'];
    for (const type of types) {
      expect(() =>
        generateWavetable({ type, frameCount: 4, samplesPerFrame: 256, complexity: 5 })
      ).not.toThrow();
    }
  });
});

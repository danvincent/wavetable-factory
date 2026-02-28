'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');

// Mock child_process.spawn for playback tests
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    kill: jest.fn(),
    pid: 12345,
  })),
}));

const { spawn } = require('child_process');
const {
  loadWavetable,
  getWindow,
  positionClamp,
  windowSizeClamp,
  startPlayback,
  stopPlayback,
  updatePlaybackWindow,
} = require('../../src/audio/player');
const { exportForAbleton, exportForPolyend } = require('../../src/engine/exporter');

const TMP_DIR = path.join(os.tmpdir(), 'wf-player-test-' + process.pid);

beforeAll(async () => {
  fs.ensureDirSync(TMP_DIR);
  // Write test WAV files using the real exporter
  const abletonFrames = Array.from({ length: 4 }, () => {
    const f = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) f[i] = Math.sin(2 * Math.PI * i / 2048) * 0.5;
    return f;
  });
  const polyendFrames = [(() => {
    const f = new Float32Array(256);
    for (let i = 0; i < 256; i++) f[i] = Math.sin(2 * Math.PI * i / 256) * 0.5;
    return f;
  })()];
  await exportForAbleton(abletonFrames, path.join(TMP_DIR, 'ableton.wav'));
  await exportForPolyend(polyendFrames, path.join(TMP_DIR, 'polyend.wav'));
});

afterAll(() => fs.removeSync(TMP_DIR));
afterEach(() => { stopPlayback(); jest.clearAllMocks(); });

// ── positionClamp ─────────────────────────────────────────────────────────────

describe('positionClamp(value)', () => {
  test('clamps below 0 to 0', () => expect(positionClamp(-0.5)).toBe(0));
  test('clamps above 1 to 1', () => expect(positionClamp(1.5)).toBe(1));
  test('passes through midrange value', () => expect(positionClamp(0.5)).toBeCloseTo(0.5));
  test('passes through 0 exactly', () => expect(positionClamp(0)).toBe(0));
  test('passes through 1 exactly', () => expect(positionClamp(1)).toBe(1));
});

// ── windowSizeClamp ───────────────────────────────────────────────────────────

describe('windowSizeClamp(value, totalFrames)', () => {
  test('clamps below 1 to 1', () => expect(windowSizeClamp(0, 64)).toBe(1));
  test('clamps above totalFrames to totalFrames', () => expect(windowSizeClamp(100, 64)).toBe(64));
  test('passes through valid value', () => expect(windowSizeClamp(8, 64)).toBe(8));
  test('clamps negative to 1', () => expect(windowSizeClamp(-5, 64)).toBe(1));
});

// ── loadWavetable ─────────────────────────────────────────────────────────────

describe('loadWavetable(filePath)', () => {
  test('loads Ableton WAV and returns frames, sampleRate, bitDepth', async () => {
    const result = await loadWavetable(path.join(TMP_DIR, 'ableton.wav'));
    expect(result).toHaveProperty('frames');
    expect(result).toHaveProperty('sampleRate');
    expect(result).toHaveProperty('bitDepth');
  });

  test('Ableton WAV has 4 frames of 2048 samples', async () => {
    const { frames } = await loadWavetable(path.join(TMP_DIR, 'ableton.wav'));
    expect(frames).toHaveLength(4);
    expect(frames[0]).toHaveLength(2048);
  });

  test('Ableton WAV has sampleRate 44100 and bitDepth 32', async () => {
    const { sampleRate, bitDepth } = await loadWavetable(path.join(TMP_DIR, 'ableton.wav'));
    expect(sampleRate).toBe(44100);
    expect(bitDepth).toBe(32);
  });

  test('Polyend WAV has 1 frame of 256 samples', async () => {
    const { frames } = await loadWavetable(path.join(TMP_DIR, 'polyend.wav'));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(256);
  });

  test('Polyend WAV has sampleRate 44100 and bitDepth 16', async () => {
    const { sampleRate, bitDepth } = await loadWavetable(path.join(TMP_DIR, 'polyend.wav'));
    expect(sampleRate).toBe(44100);
    expect(bitDepth).toBe(16);
  });

  test('all frame samples are in [-1, 1]', async () => {
    const { frames } = await loadWavetable(path.join(TMP_DIR, 'ableton.wav'));
    for (const frame of frames) {
      for (const s of frame) {
        expect(s).toBeGreaterThanOrEqual(-1.1);
        expect(s).toBeLessThanOrEqual(1.1);
      }
    }
  });

  test('throws on non-existent file', async () => {
    await expect(loadWavetable('/nope/ghost.wav')).rejects.toThrow();
  });
});

// ── getWindow ─────────────────────────────────────────────────────────────────

describe('getWindow(frames, position, windowSize)', () => {
  const frames = Array.from({ length: 8 }, (_, i) => {
    const f = new Float32Array(4);
    f.fill(i / 8);
    return f;
  });

  test('returns Float32Array', () => {
    expect(getWindow(frames, 0, 1)).toBeInstanceOf(Float32Array);
  });

  test('window of 1 frame returns exactly samplesPerFrame samples', () => {
    const w = getWindow(frames, 0, 1);
    expect(w.length).toBe(4);
  });

  test('window of 4 frames returns 4 * samplesPerFrame samples', () => {
    const w = getWindow(frames, 0, 4);
    expect(w.length).toBe(16);
  });

  test('position=0 starts from first frame', () => {
    const w = getWindow(frames, 0, 1);
    expect(w[0]).toBeCloseTo(0);
  });

  test('position=0.5 starts from middle frame', () => {
    const w = getWindow(frames, 0.5, 1);
    // Frame 4 of 8 has value 4/8 = 0.5
    expect(w[0]).toBeCloseTo(0.5, 2);
  });

  test('position=1 starts from last possible frame', () => {
    const w = getWindow(frames, 1, 1);
    // Last frame (index 7) has value 7/8
    expect(w[0]).toBeCloseTo(7 / 8, 2);
  });

  test('window clamps at end of frames array', () => {
    // position near end + large window shouldn't throw or exceed array
    expect(() => getWindow(frames, 0.9, 4)).not.toThrow();
  });
});

// ── startPlayback / stopPlayback ──────────────────────────────────────────────

describe('startPlayback(samples, sampleRate)', () => {
  test('spawns ffplay process with temp WAV file', () => {
    const samples = new Float32Array(256);
    startPlayback(samples, 44100);
    expect(spawn).toHaveBeenCalledWith(
      'ffplay',
      expect.arrayContaining(['-loop', '0']),
      expect.any(Object)
    );
  });

  test('stopPlayback kills the process', () => {
    startPlayback(new Float32Array(256), 44100);
    const proc = spawn.mock.results[0].value;
    stopPlayback();
    expect(proc.kill).toHaveBeenCalled();
  });

  test('stopPlayback is safe when nothing is playing', () => {
    expect(() => stopPlayback()).not.toThrow();
  });
});

describe('updatePlaybackWindow(samples)', () => {
  test('does not throw when player is not started', () => {
    expect(() => updatePlaybackWindow(new Float32Array(256))).not.toThrow();
  });

  test('accepts new sample buffer while playing', () => {
    startPlayback(new Float32Array(256), 44100);
    expect(() => updatePlaybackWindow(new Float32Array(512), 44100)).not.toThrow();
    stopPlayback();
  });
});

// ── synthesize ────────────────────────────────────────────────────────────────

const { synthesize } = require('../../src/audio/player');

describe('synthesize(frames, position, windowSize, freq, sampleRate, durationSec)', () => {
  // Build a recognisable test frame: a perfect sine, 2048 samples
  const SAMPLES_PER_FRAME = 2048;
  const FRAME = (() => {
    const f = new Float32Array(SAMPLES_PER_FRAME);
    for (let i = 0; i < SAMPLES_PER_FRAME; i++) f[i] = Math.sin(2 * Math.PI * i / SAMPLES_PER_FRAME);
    return f;
  })();
  const FRAMES = [FRAME, FRAME, FRAME, FRAME]; // 4 identical frames

  test('returns a Float32Array', () => {
    const out = synthesize(FRAMES, 0, 1, 261.63, 44100, 0.1);
    expect(out).toBeInstanceOf(Float32Array);
  });

  test('output length equals round(sampleRate * durationSec)', () => {
    const out = synthesize(FRAMES, 0, 1, 261.63, 44100, 0.5);
    expect(out.length).toBe(Math.round(44100 * 0.5));
  });

  test('output is audibly at the correct frequency (zero crossing count)', () => {
    const freq = 440;
    const sampleRate = 44100;
    const duration = 1.0;
    const out = synthesize(FRAMES, 0, 1, freq, sampleRate, duration);
    // Count zero crossings (positive-going) — should be ~freq per second
    let crossings = 0;
    for (let i = 1; i < out.length; i++) {
      if (out[i - 1] < 0 && out[i] >= 0) crossings++;
    }
    expect(crossings).toBeGreaterThan(freq * 0.9);
    expect(crossings).toBeLessThan(freq * 1.1);
  });

  test('all samples are in [-1, 1]', () => {
    const out = synthesize(FRAMES, 0, 1, 261.63, 44100, 0.1);
    for (const s of out) {
      expect(Math.abs(s)).toBeLessThanOrEqual(1.001);
    }
  });

  test('position 0 uses first frame, position 1 uses last frame', () => {
    const lowFrame = new Float32Array(SAMPLES_PER_FRAME).fill(0.1);  // DC offset ~0.1
    const highFrame = new Float32Array(SAMPLES_PER_FRAME).fill(0.9); // DC offset ~0.9
    const frames = [lowFrame, highFrame];
    const outLow  = synthesize(frames, 0, 1, 261.63, 44100, 0.01);
    const outHigh = synthesize(frames, 1, 1, 261.63, 44100, 0.01);
    const avgLow  = outLow.reduce((a, v) => a + v, 0) / outLow.length;
    const avgHigh = outHigh.reduce((a, v) => a + v, 0) / outHigh.length;
    expect(avgLow).toBeCloseTo(0.1, 1);
    expect(avgHigh).toBeCloseTo(0.9, 1);
  });

  test('windowSize 1 holds a single frame throughout', () => {
    const silentFrame = new Float32Array(SAMPLES_PER_FRAME).fill(0);
    const loudFrame   = new Float32Array(SAMPLES_PER_FRAME).fill(0.5);
    const frames = [silentFrame, loudFrame, silentFrame, loudFrame];
    // position=0, window=1 → only frame 0 (silent)
    const out = synthesize(frames, 0, 1, 261.63, 44100, 0.05);
    const rms = Math.sqrt(out.reduce((a, v) => a + v * v, 0) / out.length);
    expect(rms).toBeCloseTo(0, 3);
  });

  test('works with Polyend-format frames (256 samples)', () => {
    const smallFrame = (() => {
      const f = new Float32Array(256);
      for (let i = 0; i < 256; i++) f[i] = Math.sin(2 * Math.PI * i / 256);
      return f;
    })();
    const out = synthesize([smallFrame], 0, 1, 261.63, 44100, 0.05);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(Math.round(44100 * 0.05));
  });
});

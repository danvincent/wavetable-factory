'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');

// Mock child_process.spawn for playback tests
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdin: { write: jest.fn(), end: jest.fn(), destroyed: false, on: jest.fn() },
    stderr: { on: jest.fn() },
    stdout: { on: jest.fn() },
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
  test('spawns ffplay process', () => {
    const samples = new Float32Array(256);
    startPlayback(samples, 44100);
    expect(spawn).toHaveBeenCalledWith(
      'ffplay',
      expect.arrayContaining(['-f', 's16le', '-ar', '44100']),
      expect.any(Object)
    );
  });

  test('writes data to ffplay stdin', () => {
    const samples = new Float32Array(256);
    startPlayback(samples, 44100);
    const proc = spawn.mock.results[0].value;
    expect(proc.stdin.write).toHaveBeenCalled();
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
    expect(() => updatePlaybackWindow(new Float32Array(512))).not.toThrow();
    stopPlayback();
  });
});

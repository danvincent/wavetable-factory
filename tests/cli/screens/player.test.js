'use strict';

jest.mock('../../../src/audio/player', () => ({
  loadWavetable:       jest.fn(),
  synthesize:          jest.fn(),
  startPlayback:       jest.fn(),
  stopPlayback:        jest.fn(),
  updatePlaybackWindow: jest.fn(),
  positionClamp:       jest.fn(v => Math.max(0, Math.min(1, v))),
  windowSizeClamp:     jest.fn((v, max) => Math.max(1, Math.min(max, Math.round(v)))),
}));

jest.mock('../../../src/cli/prompt', () => ({
  printHeader:    jest.fn(),
  printInfo:      jest.fn(),
  printError:     jest.fn(),
  hr:             jest.fn(),
  renderWaveform: jest.fn(() => '▄▄▄▄▄▄▄▄▄▄'),
  closeRL:        jest.fn(),
}));

const {
  loadWavetable, synthesize, startPlayback, stopPlayback, updatePlaybackWindow,
} = require('../../../src/audio/player');
const { printHeader, printError, closeRL } = require('../../../src/cli/prompt');
const { playerMenu, renderPlayerState, handleKey } = require('../../../src/cli/screens/player');

const FAKE_FRAME = new Float32Array(2048).fill(0.5);
const FAKE_FRAMES = [FAKE_FRAME, FAKE_FRAME, FAKE_FRAME, FAKE_FRAME];
const FAKE_WAVETABLE = { frames: FAKE_FRAMES, sampleRate: 44100, bitDepth: 32 };
const FAKE_SYNTH = new Float32Array(88200);

beforeEach(() => {
  jest.clearAllMocks();
  loadWavetable.mockResolvedValue(FAKE_WAVETABLE);
  synthesize.mockReturnValue(FAKE_SYNTH);
});

// ── renderPlayerState ─────────────────────────────────────────────────────────

describe('renderPlayerState(state)', () => {
  test('contains PLAYING when playing=true', () => {
    const s = renderPlayerState({ playing: true, position: 0.5, windowSize: 2, totalFrames: 64 });
    expect(s).toMatch(/PLAYING/);
  });

  test('contains STOPPED when playing=false', () => {
    const s = renderPlayerState({ playing: false, position: 0, windowSize: 1, totalFrames: 64 });
    expect(s).toMatch(/STOPPED/);
  });

  test('contains position as percentage', () => {
    const s = renderPlayerState({ playing: false, position: 0.5, windowSize: 1, totalFrames: 64 });
    expect(s).toMatch(/50%/);
  });

  test('contains window size and total frames', () => {
    const s = renderPlayerState({ playing: false, position: 0, windowSize: 8, totalFrames: 64 });
    expect(s).toMatch(/8/);
    expect(s).toMatch(/64/);
  });

  test('contains keyboard hint for controls', () => {
    const s = renderPlayerState({ playing: false, position: 0, windowSize: 1, totalFrames: 4 });
    expect(s).toMatch(/\[p\]/i);
    expect(s).toMatch(/\[q\]/i);
  });
});

// ── handleKey ─────────────────────────────────────────────────────────────────

describe('handleKey(key, state, wavetable)', () => {
  function makeState(overrides = {}) {
    return { playing: false, position: 0.5, windowSize: 2, totalFrames: 64, ...overrides };
  }
  const wt = { frames: FAKE_FRAMES, sampleRate: 44100 };

  test('q returns false (exit signal)', () => {
    const state = makeState();
    expect(handleKey('q', state, wt)).toBe(false);
  });

  test('q calls stopPlayback', () => {
    handleKey('q', makeState({ playing: true }), wt);
    expect(stopPlayback).toHaveBeenCalled();
  });

  test('p starts playback when stopped', () => {
    const state = makeState({ playing: false });
    handleKey('p', state, wt);
    expect(synthesize).toHaveBeenCalled();
    expect(startPlayback).toHaveBeenCalled();
    expect(state.playing).toBe(true);
  });

  test('p stops playback when playing', () => {
    const state = makeState({ playing: true });
    handleKey('p', state, wt);
    expect(stopPlayback).toHaveBeenCalled();
    expect(state.playing).toBe(false);
  });

  test('right arrow increases position by 0.05', () => {
    const state = makeState({ position: 0.5 });
    handleKey('\u001b[C', state, wt);
    expect(state.position).toBeCloseTo(0.55);
  });

  test('right arrow clamps at 1.0', () => {
    const state = makeState({ position: 0.98 });
    handleKey('\u001b[C', state, wt);
    expect(state.position).toBeLessThanOrEqual(1.0);
  });

  test('left arrow decreases position by 0.05', () => {
    const state = makeState({ position: 0.5 });
    handleKey('\u001b[D', state, wt);
    expect(state.position).toBeCloseTo(0.45);
  });

  test('left arrow clamps at 0.0', () => {
    const state = makeState({ position: 0.02 });
    handleKey('\u001b[D', state, wt);
    expect(state.position).toBeGreaterThanOrEqual(0.0);
  });

  test('up arrow increases windowSize by 1', () => {
    const state = makeState({ windowSize: 4 });
    handleKey('\u001b[A', state, wt);
    expect(state.windowSize).toBe(5);
  });

  test('down arrow decreases windowSize by 1', () => {
    const state = makeState({ windowSize: 4 });
    handleKey('\u001b[B', state, wt);
    expect(state.windowSize).toBe(3);
  });

  test('down arrow clamps windowSize at 1', () => {
    const state = makeState({ windowSize: 1 });
    handleKey('\u001b[B', state, wt);
    expect(state.windowSize).toBe(1);
  });

  test('position change while playing calls updatePlaybackWindow', () => {
    const state = makeState({ playing: true, position: 0.5 });
    handleKey('\u001b[C', state, wt);
    expect(updatePlaybackWindow).toHaveBeenCalled();
  });

  test('Q (uppercase) also exits', () => {
    const state = makeState();
    expect(handleKey('Q', state, wt)).toBe(false);
  });

  test('Ctrl+C exits', () => {
    const state = makeState();
    expect(handleKey('\u0003', state, wt)).toBe(false);
  });

  test('unknown key returns true (continue)', () => {
    expect(handleKey('x', makeState(), wt)).toBe(true);
  });
});

// ── playerMenu ────────────────────────────────────────────────────────────────

describe('playerMenu(filePath)', () => {
  // Simulate raw stdin by overriding process.stdin methods
  let keyListeners = [];
  const mockSetRawMode = jest.fn();
  const mockResume = jest.fn();
  const mockPause = jest.fn();
  const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

  beforeEach(() => {
    keyListeners = [];
    mockSetRawMode.mockClear();
    mockResume.mockClear();
    mockPause.mockClear();
    // Override stdin
    process.stdin.setRawMode = mockSetRawMode;
    process.stdin.resume = mockResume;
    process.stdin.pause = mockPause;
    process.stdin.setEncoding = jest.fn();
    process.stdin.on = jest.fn((event, cb) => { if (event === 'data') keyListeners.push(cb); });
    process.stdin.removeListener = jest.fn();
  });

  function pressKey(key) {
    keyListeners.forEach(cb => cb(key));
  }

  test('calls loadWavetable with the given filePath', async () => {
    const p = playerMenu('/lib/test.wav');
    await Promise.resolve(); // flush loadWavetable microtask
    pressKey('q');
    await p;
    expect(loadWavetable).toHaveBeenCalledWith('/lib/test.wav');
  });

  test('prints header with filename', async () => {
    const p = playerMenu('/lib/ableton/warm-arc-sine.wav');
    await Promise.resolve();
    pressKey('q');
    await p;
    expect(printHeader).toHaveBeenCalledWith(expect.stringMatching(/warm-arc-sine\.wav/));
  });

  test('calls closeRL before entering raw mode', async () => {
    const p = playerMenu('/lib/test.wav');
    await Promise.resolve();
    expect(closeRL).toHaveBeenCalled();
    pressKey('q');
    await p;
  });

  test('does NOT call process.stdin.pause() on exit (prevents hang)', async () => {
    const p = playerMenu('/lib/test.wav');
    await Promise.resolve();
    pressKey('q');
    await p;
    expect(mockPause).not.toHaveBeenCalled();
  });

  test('calls stopPlayback on quit', async () => {
    const p = playerMenu('/lib/test.wav');
    await Promise.resolve();
    pressKey('q');
    await p;
    expect(stopPlayback).toHaveBeenCalled();
  });

  test('shows error and returns if loadWavetable throws', async () => {
    loadWavetable.mockRejectedValueOnce(new Error('file not found'));
    await playerMenu('/bad/path.wav');
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/file not found/));
  });

  test('enables raw mode on enter, disables on quit', async () => {
    const p = playerMenu('/lib/test.wav');
    await Promise.resolve();
    expect(mockSetRawMode).toHaveBeenCalledWith(true);
    pressKey('q');
    await p;
    expect(mockSetRawMode).toHaveBeenCalledWith(false);
  });
});

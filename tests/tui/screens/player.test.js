'use strict';

jest.mock('blessed', () => {
  const widget = () => ({
    append: jest.fn(), hide: jest.fn(), show: jest.fn(), focus: jest.fn(),
    key: jest.fn(), on: jest.fn(), setContent: jest.fn(), setLabel: jest.fn(),
    render: jest.fn(), destroy: jest.fn(), screen: null,
  });
  return {
    screen: jest.fn(widget), box: jest.fn(widget), list: jest.fn(widget),
    text: jest.fn(widget), button: jest.fn(widget),
  };
});

jest.mock('../../../src/audio/player', () => ({
  loadWavetable: jest.fn(),
  getWindow: jest.fn(() => new Float32Array(2048)),
  startPlayback: jest.fn(),
  stopPlayback: jest.fn(),
  updatePlaybackWindow: jest.fn(),
  positionClamp: jest.fn(v => Math.max(0, Math.min(1, v))),
  windowSizeClamp: jest.fn((v, max) => Math.max(1, Math.min(max, v))),
}));

const { renderWaveformASCII, createPlayerState } = require('../../../src/tui/screens/player');

beforeEach(() => jest.clearAllMocks());

// ── renderWaveformASCII ───────────────────────────────────────────────────────

describe('renderWaveformASCII(samples, width, height)', () => {
  test('returns array of exactly height strings', () => {
    const samples = new Float32Array(512).map((_, i) => Math.sin(2 * Math.PI * i / 512));
    const rows = renderWaveformASCII(samples, 60, 10);
    expect(rows).toHaveLength(10);
  });

  test('each row is exactly width characters', () => {
    const samples = new Float32Array(512).fill(0.5);
    const rows = renderWaveformASCII(samples, 60, 10);
    for (const row of rows) {
      expect(row.length).toBe(60);
    }
  });

  test('silence produces a row of spaces at center with center-line character', () => {
    const samples = new Float32Array(256).fill(0);
    const rows = renderWaveformASCII(samples, 40, 10);
    // Center row (index 5) should contain a visible center-line character
    const centerRow = rows[Math.floor(10 / 2)];
    expect(centerRow).not.toMatch(/^ +$/); // not pure spaces
  });

  test('full-scale positive signal fills upper half', () => {
    const samples = new Float32Array(256).fill(1.0);
    const rows = renderWaveformASCII(samples, 40, 10);
    // Top row should have signal characters
    const topRow = rows[0];
    expect(topRow).not.toMatch(/^ +$/);
  });

  test('full-scale negative signal fills lower half', () => {
    const samples = new Float32Array(256).fill(-1.0);
    const rows = renderWaveformASCII(samples, 40, 10);
    const bottomRow = rows[9];
    expect(bottomRow).not.toMatch(/^ +$/);
  });

  test('returns correct structure for minimal 1x1 case', () => {
    const samples = new Float32Array([0]);
    const rows = renderWaveformASCII(samples, 1, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].length).toBe(1);
  });

  test('handles empty sample array gracefully', () => {
    expect(() => renderWaveformASCII(new Float32Array(0), 40, 10)).not.toThrow();
  });
});

// ── createPlayerState ─────────────────────────────────────────────────────────

describe('createPlayerState()', () => {
  test('returns default position of 0', () => {
    const state = createPlayerState();
    expect(state.position).toBe(0);
  });

  test('returns default windowSize of 1', () => {
    const state = createPlayerState();
    expect(state.windowSize).toBe(1);
  });

  test('returns isPlaying false initially', () => {
    const state = createPlayerState();
    expect(state.isPlaying).toBe(false);
  });

  test('returns frames as null initially', () => {
    const state = createPlayerState();
    expect(state.frames).toBeNull();
  });

  test('setPosition clamps value between 0 and 1', () => {
    const state = createPlayerState();
    state.setPosition(-0.5);
    expect(state.position).toBe(0);
    state.setPosition(1.5);
    expect(state.position).toBe(1);
    state.setPosition(0.7);
    expect(state.position).toBeCloseTo(0.7);
  });

  test('setWindowSize clamps to 1..totalFrames', () => {
    const state = createPlayerState();
    state.frames = Array.from({ length: 64 }, () => new Float32Array(2048));
    state.setWindowSize(0);
    expect(state.windowSize).toBe(1);
    state.setWindowSize(100);
    expect(state.windowSize).toBe(64);
    state.setWindowSize(8);
    expect(state.windowSize).toBe(8);
  });

  test('nudgePosition adds delta and clamps', () => {
    const state = createPlayerState();
    state.setPosition(0.5);
    state.nudgePosition(0.1);
    expect(state.position).toBeCloseTo(0.6);
    state.nudgePosition(1.0); // would exceed 1
    expect(state.position).toBe(1);
  });

  test('nudgeWindowSize adds delta and clamps', () => {
    const state = createPlayerState();
    state.frames = Array.from({ length: 16 }, () => new Float32Array(256));
    state.setWindowSize(4);
    state.nudgeWindowSize(2);
    expect(state.windowSize).toBe(6);
    state.nudgeWindowSize(-10); // would go below 1
    expect(state.windowSize).toBe(1);
  });
});

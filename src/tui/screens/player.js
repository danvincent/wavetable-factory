'use strict';

const blessed = require('blessed');
const {
  loadWavetable,
  getWindow,
  positionClamp,
  windowSizeClamp,
  startPlayback,
  stopPlayback,
  updatePlaybackWindow,
} = require('../../audio/player');

// ── ASCII waveform renderer ───────────────────────────────────────────────────

const FILL_CHAR = '█';
const CENTER_CHAR = '─';
const EMPTY_CHAR = ' ';

/**
 * Render a Float32Array as an ASCII waveform display.
 * Returns an array of `height` strings, each exactly `width` characters.
 * Center row = 0.0, top = +1.0, bottom = -1.0.
 *
 * @param {Float32Array} samples
 * @param {number} width - columns
 * @param {number} height - rows
 * @returns {string[]}
 */
function renderWaveformASCII(samples, width, height) {
  // Build a 2D grid: rows[r][c]
  const grid = Array.from({ length: height }, () => Array(width).fill(EMPTY_CHAR));
  const centerRow = Math.floor(height / 2);

  // Draw center line
  for (let c = 0; c < width; c++) {
    grid[centerRow][c] = CENTER_CHAR;
  }

  if (samples.length === 0) {
    return grid.map(row => row.join(''));
  }

  const samplesPerCol = Math.max(1, Math.floor(samples.length / width));

  for (let c = 0; c < width; c++) {
    const start = c * samplesPerCol;
    const end = Math.min(samples.length, start + samplesPerCol);
    let maxVal = 0;
    let minVal = 0;
    for (let s = start; s < end; s++) {
      if (samples[s] > maxVal) maxVal = samples[s];
      if (samples[s] < minVal) minVal = samples[s];
    }

    // Map to row indices (top = 0, bottom = height-1)
    const topRow = Math.round(centerRow - maxVal * centerRow);
    const botRow = Math.round(centerRow - minVal * (height - 1 - centerRow));

    for (let r = 0; r < height; r++) {
      if (r >= topRow && r <= botRow) {
        grid[r][c] = FILL_CHAR;
      }
    }
  }

  return grid.map(row => row.join(''));
}

// ── Player state ──────────────────────────────────────────────────────────────

/**
 * Create a self-contained player state object with clamped mutators.
 * @returns {{ position, windowSize, isPlaying, frames, setPosition, setWindowSize, nudgePosition, nudgeWindowSize }}
 */
function createPlayerState() {
  const state = {
    position: 0,
    windowSize: 1,
    isPlaying: false,
    frames: null,

    setPosition(value) {
      state.position = positionClamp(value);
    },

    setWindowSize(value) {
      const total = state.frames ? state.frames.length : 1;
      state.windowSize = windowSizeClamp(value, total);
    },

    nudgePosition(delta) {
      state.setPosition(state.position + delta);
    },

    nudgeWindowSize(delta) {
      state.setWindowSize(state.windowSize + delta);
    },
  };
  return state;
}

// ── TUI screen ────────────────────────────────────────────────────────────────

const POSITION_STEP = 0.01;
const WINDOW_STEP = 1;

/**
 * Create the Player TUI screen.
 * @param {object} panel - blessed box (content panel)
 * @returns {{ container: object, loadFile: function }}
 */
function createPlayerScreen(panel) {
  const state = createPlayerState();

  const container = blessed.box({
    top: 0, left: 0, width: '100%', height: '100%',
    label: ' Player ', style: { label: { fg: 'cyan' } },
  });

  // ── File name header ──────────────────────────────────────────────────────
  const fileLabel = blessed.text({
    parent: container,
    top: 0, left: 2, right: 2, height: 1,
    content: 'No file loaded',
    style: { fg: 'cyan' },
  });

  // ── Waveform display ──────────────────────────────────────────────────────
  const waveBox = blessed.box({
    parent: container,
    top: 1, left: 1, right: 1, height: 12,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } },
    content: '',
    tags: false,
  });

  // ── Position bar ──────────────────────────────────────────────────────────
  blessed.text({ parent: container, top: 14, left: 2, content: 'Position:' });
  const posLabel = blessed.text({
    parent: container, top: 14, left: 12, width: 20,
    content: '0.00',
    style: { fg: 'green' },
  });

  // ── Window size bar ───────────────────────────────────────────────────────
  blessed.text({ parent: container, top: 15, left: 2, content: 'Window:  ' });
  const winLabel = blessed.text({
    parent: container, top: 15, left: 12, width: 20,
    content: '1 frame(s)',
    style: { fg: 'yellow' },
  });

  // ── Status / help ─────────────────────────────────────────────────────────
  const helpText = blessed.text({
    parent: container,
    bottom: 0, left: 0, right: 0, height: 1,
    content: ' [Space] Play/Stop  [←/→] Position  [[] Win-  []] Win+  [r] Reload ',
    style: { fg: 'black', bg: 'cyan' },
  });

  const statusBox = blessed.box({
    parent: container,
    bottom: 1, left: 0, right: 0, height: 1,
    content: '',
    tags: true,
    style: { fg: 'white' },
  });

  function setStatus(msg, isError = false) {
    statusBox.setContent(isError ? `{red-fg}${msg}{/red-fg}` : msg);
    renderAll();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  function renderAll() {
    if (state.frames) {
      posLabel.setContent(state.position.toFixed(2));
      winLabel.setContent(`${state.windowSize} frame(s)`);
      const samples = getWindow(state.frames, state.position, state.windowSize);
      // Waveform box inner dimensions (approximate; border takes 2 chars each side)
      const rows = renderWaveformASCII(samples, 78, 10);
      waveBox.setContent(rows.join('\n'));
    }
    if (container.screen) container.screen.render();
  }

  // ── Playback toggle ───────────────────────────────────────────────────────
  function togglePlay() {
    if (!state.frames) { setStatus('No file loaded', true); return; }
    state.isPlaying = !state.isPlaying;
    if (state.isPlaying) {
      const samples = getWindow(state.frames, state.position, state.windowSize);
      startPlayback(samples, 44100);
      setStatus('▶ Playing');
    } else {
      stopPlayback();
      setStatus('■ Stopped');
    }
  }

  // ── Update window while playing ───────────────────────────────────────────
  function applyWindowUpdate() {
    if (state.isPlaying && state.frames) {
      const samples = getWindow(state.frames, state.position, state.windowSize);
      updatePlaybackWindow(samples);
    }
    renderAll();
  }

  // ── Keybindings ───────────────────────────────────────────────────────────
  container.key(['space'], () => togglePlay());
  container.key(['left'], () => { state.nudgePosition(-POSITION_STEP); applyWindowUpdate(); });
  container.key(['right'], () => { state.nudgePosition(POSITION_STEP); applyWindowUpdate(); });
  container.key(['['], () => { state.nudgeWindowSize(-WINDOW_STEP); applyWindowUpdate(); });
  container.key([']'], () => { state.nudgeWindowSize(WINDOW_STEP); applyWindowUpdate(); });
  container.key(['r'], () => { if (state.currentPath) loadFile(state.currentPath); });

  // Stop playback when leaving screen
  container.on('hide', () => {
    if (state.isPlaying) { stopPlayback(); state.isPlaying = false; }
  });

  // ── Public API ────────────────────────────────────────────────────────────
  async function loadFile(filePath) {
    try {
      setStatus(`Loading ${filePath}…`);
      const result = await loadWavetable(filePath);
      state.frames = result.frames;
      state.currentPath = filePath;
      state.setPosition(0);
      state.setWindowSize(1);
      fileLabel.setContent(require('path').basename(filePath));
      setStatus(`Loaded ${result.frames.length} frame(s) — ${result.sampleRate}Hz ${result.bitDepth}-bit`);
    } catch (err) {
      setStatus(`Error: ${err.message}`, true);
    }
  }

  panel.append(container);
  return { container, loadFile, state };
}

module.exports = { renderWaveformASCII, createPlayerState, createPlayerScreen };

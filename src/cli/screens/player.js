'use strict';

const path  = require('path');
const chalk = require('chalk');

const { printHeader, printInfo, printError, hr, renderWaveform, closeRL } = require('../prompt');
const {
  loadWavetable, synthesize,
  startPlayback, stopPlayback, updatePlaybackWindow,
  positionClamp, windowSizeClamp,
} = require('../../audio/player');

// Middle C
const PREVIEW_FREQ     = 261.63;
const PREVIEW_DURATION = 10.0; // seconds of synthesized audio written to temp WAV
const WAVEFORM_WIDTH   = 52;

// ── State rendering ───────────────────────────────────────────────────────────

/**
 * Render a single-line state display for the player.
 * @param {{ playing: boolean, position: number, windowSize: number, totalFrames: number }} state
 * @returns {string}
 */
function renderPlayerState(state) {
  const status     = state.playing ? chalk.green('▶  PLAYING') : chalk.dim('■  STOPPED');
  const pos        = (state.position * 100).toFixed(0).padStart(3);
  const win        = String(state.windowSize).padStart(3);
  const total      = state.totalFrames;
  return `${status}   pos: ${chalk.yellow(pos + '%')}   window: ${chalk.cyan(win)}/${total}   ${chalk.dim('[←→] pos  [↑↓] window  [p] play  [q] quit')}`;
}

// ── Key handler (pure, testable) ──────────────────────────────────────────────

/**
 * Handle a keypress and mutate state.
 * Returns false to signal exit, true to continue.
 * @param {string} key
 * @param {{ playing: boolean, position: number, windowSize: number, totalFrames: number }} state
 * @param {{ frames: Float32Array[], sampleRate: number }} wavetable
 * @returns {boolean}
 */
function handleKey(key, state, wavetable) {
  const POSITION_STEP = 0.05;

  switch (key) {
    case 'q':
    case 'Q':
    case '\u0003': // Ctrl+C
      stopPlayback();
      state.playing = false;
      return false; // exit

    case 'p':
    case 'P': {
      if (state.playing) {
        stopPlayback();
        state.playing = false;
      } else {
        const samples = synthesize(
          wavetable.frames, state.position, state.windowSize,
          PREVIEW_FREQ, wavetable.sampleRate, PREVIEW_DURATION
        );
        startPlayback(samples, wavetable.sampleRate);
        state.playing = true;
      }
      return true;
    }

    case '\u001b[C': // right arrow → increase position
      state.position = positionClamp(state.position + POSITION_STEP);
      if (state.playing) _resynthesize(state, wavetable);
      return true;

    case '\u001b[D': // left arrow → decrease position
      state.position = positionClamp(state.position - POSITION_STEP);
      if (state.playing) _resynthesize(state, wavetable);
      return true;

    case '\u001b[A': // up arrow → increase window size
      state.windowSize = windowSizeClamp(state.windowSize + 1, state.totalFrames);
      if (state.playing) _resynthesize(state, wavetable);
      return true;

    case '\u001b[B': // down arrow → decrease window size
      state.windowSize = windowSizeClamp(state.windowSize - 1, state.totalFrames);
      if (state.playing) _resynthesize(state, wavetable);
      return true;

    default:
      return true;
  }
}

function _resynthesize(state, wavetable) {
  const samples = synthesize(
    wavetable.frames, state.position, state.windowSize,
    PREVIEW_FREQ, wavetable.sampleRate, PREVIEW_DURATION
  );
  updatePlaybackWindow(samples, wavetable.sampleRate);
}

// ── Main player screen ────────────────────────────────────────────────────────

async function playerMenu(filePath) {
  let wavetable;
  try {
    wavetable = await loadWavetable(filePath);
  } catch (err) {
    printError(`Could not load wavetable: ${err.message}`);
    return;
  }

  const { frames, sampleRate } = wavetable;
  const filename = path.basename(filePath);

  printHeader(`Player — ${filename}`);

  // ASCII waveform preview of frame 0
  const preview = renderWaveform(frames[0], WAVEFORM_WIDTH);
  printInfo(chalk.cyan(preview));
  printInfo(`  ${frames.length} frames  ·  ${frames[0].length} samples/frame  ·  ${sampleRate} Hz  ·  middle C`);
  hr();

  const state = {
    playing:     false,
    position:    0,
    windowSize:  1,
    totalFrames: frames.length,
  };

  // Close readline before taking over stdin in raw mode.
  // The next ask() call will re-create it cleanly.
  closeRL();

  // Enter raw mode for single-keypress handling
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise(resolve => {
    function redraw() {
      process.stdout.write('\r' + renderPlayerState(state) + '  ');
    }

    redraw();

    function onKey(key) {
      const cont = handleKey(key, state, { frames, sampleRate });
      redraw();
      if (!cont) {
        process.stdin.setRawMode(false);
        // Don't pause stdin — readline will resume it when ask() is called next.
        process.stdin.removeListener('data', onKey);
        process.stdout.write('\n');
        resolve();
      }
    }

    process.stdin.on('data', onKey);
  });
}

module.exports = { playerMenu, renderPlayerState, handleKey };

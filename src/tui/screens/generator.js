'use strict';

const path = require('path');
const blessed = require('blessed');
const { WAVEFORM_TYPES, ABLETON, COMPLEXITY_MIN, COMPLEXITY_MAX } = require('../../constants');
const { generateWavetable } = require('../../engine/generator');
const { generateRandomWavetable } = require('../../engine/randomizer');
const { exportForAbleton, exportForPolyend, exportForPirateSynthWt } = require('../../engine/exporter');

const VALID_TARGETS = ['ableton', 'polyend', 'txt', 'both', 'all'];

// ── Pure logic ───────────────────────────────────────────────────────────────

/**
 * Validate and normalise form field values.
 * @param {{ type, complexity, frameCount, target }} values
 * @returns {{ type, complexity, frameCount, target }}
 * @throws {Error} on invalid input
 */
function parseFormValues(values) {
  const type = values.type;
  const complexity = parseInt(values.complexity, 10);
  const frameCount = parseInt(values.frameCount, 10);
  const target = values.target;

  if (!WAVEFORM_TYPES.includes(type)) {
    throw new Error(`Invalid type "${type}". Must be one of: ${WAVEFORM_TYPES.join(', ')}`);
  }
  if (isNaN(complexity) || complexity < COMPLEXITY_MIN || complexity > COMPLEXITY_MAX) {
    throw new Error(`Complexity must be between ${COMPLEXITY_MIN} and ${COMPLEXITY_MAX}`);
  }
  if (isNaN(frameCount) || frameCount < 1 || frameCount > 256) {
    throw new Error(`Frame count must be between 1 and 256`);
  }
  if (!VALID_TARGETS.includes(target)) {
    throw new Error(`Invalid target "${target}". Must be one of: ${VALID_TARGETS.join(', ')}`);
  }

  return { type, complexity, frameCount, target };
}

/**
 * Build a descriptive filename for a generated wavetable.
 * Format: {type}-c{complexity}-f{frameCount}-{timestamp}.wav
 * @param {{ type, complexity, frameCount }} options
 * @returns {string}
 */
function buildFilename({ type, complexity, frameCount }) {
  return `${type}-c${complexity}-f${frameCount}-${Date.now()}.wav`;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Generate a wavetable with the given options and export to the library.
 * @param {{ type, complexity, frameCount, target }} options
 * @param {string} libraryPath
 * @returns {Promise<{ success: boolean, filePaths?: string[], error?: string }>}
 */
async function onGenerate(options, libraryPath) {
  try {
    const frames = generateWavetable({
      type: options.type,
      frameCount: options.frameCount,
      samplesPerFrame: ABLETON.samplesPerFrame,
      complexity: options.complexity,
    });

    const filename = buildFilename(options);
    const filePaths = [];

    if (options.target === 'ableton' || options.target === 'both' || options.target === 'all') {
      const outPath = path.join(libraryPath, 'ableton', filename);
      await exportForAbleton(frames, outPath);
      filePaths.push(outPath);
    }
    if (options.target === 'polyend' || options.target === 'both' || options.target === 'all') {
      const outPath = path.join(libraryPath, 'polyend', filename);
      await exportForPolyend(frames, outPath);
      filePaths.push(outPath);
    }
    if (options.target === 'txt' || options.target === 'all') {
      const outPath = path.join(libraryPath, 'txt', filename.replace(/\.wav$/i, '.txt'));
      await exportForPirateSynthWt(frames, outPath);
      filePaths.push(outPath);
    }

    return { success: true, filePaths };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Generate a fully random wavetable and export to all library subfolders.
 * @param {number} complexity
 * @param {number} frameCount
 * @param {string} libraryPath
 * @returns {Promise<{ success: boolean, filePaths?: string[], error?: string }>}
 */
async function onGenerateRandom(complexity, frameCount, libraryPath) {
  try {
    const frames = generateRandomWavetable(complexity, frameCount);
    const filename = buildFilename({ type: 'random', complexity, frameCount });
    const filePaths = [];

    const abletonPath = path.join(libraryPath, 'ableton', filename);
    await exportForAbleton(frames, abletonPath);
    filePaths.push(abletonPath);

    const polyendPath = path.join(libraryPath, 'polyend', filename);
    await exportForPolyend(frames, polyendPath);
    filePaths.push(polyendPath);

    const piratePath = path.join(libraryPath, 'txt', filename.replace(/\.wav$/i, '.txt'));
    await exportForPirateSynthWt(frames, piratePath);
    filePaths.push(piratePath);

    return { success: true, filePaths };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── TUI screen ───────────────────────────────────────────────────────────────

const FIELD_DEFAULTS = {
  type: 'sine',
  complexity: 5,
  frameCount: 64,
  target: 'both',
};

/**
 * Create the Generator TUI screen inside the given content panel.
 * @param {object} panel - blessed box (content panel)
 * @param {object} config - app config (for libraryPath)
 * @returns {object} the screen container box
 */
function createGeneratorScreen(panel, config) {
  const container = blessed.box({
    top: 0, left: 0, width: '100%', height: '100%',
    label: ' Generator ', style: { label: { fg: 'cyan' } },
  });

  // Current form state
  const state = { ...FIELD_DEFAULTS };

  // ── Type selector ──────────────────────────────────────────────────────────
  blessed.text({ parent: container, top: 1, left: 2, content: 'Waveform Type:' });
  const typeList = blessed.list({
    parent: container, top: 2, left: 2, width: 20, height: WAVEFORM_TYPES.length + 2,
    label: ' Type ', border: { type: 'line' },
    style: { selected: { bg: 'blue' }, border: { fg: 'cyan' } },
    items: WAVEFORM_TYPES, keys: true, mouse: true,
  });
  typeList.select(WAVEFORM_TYPES.indexOf(state.type));
  typeList.on('select item', (_, idx) => { state.type = WAVEFORM_TYPES[idx]; });

  // ── Complexity input ───────────────────────────────────────────────────────
  const FORM_LEFT = 26;
  blessed.text({ parent: container, top: 1, left: FORM_LEFT, content: 'Complexity (1-10):' });
  const complexityBox = blessed.textbox({
    parent: container, top: 2, left: FORM_LEFT, width: 8, height: 3,
    border: { type: 'line' }, style: { border: { fg: 'cyan' }, focus: { border: { fg: 'yellow' } } },
    inputOnFocus: true, value: String(state.complexity),
  });
  complexityBox.on('submit', val => { state.complexity = parseInt(val, 10) || state.complexity; });

  // ── Frame count input ──────────────────────────────────────────────────────
  blessed.text({ parent: container, top: 1, left: FORM_LEFT + 12, content: 'Frames (1-256):' });
  const frameBox = blessed.textbox({
    parent: container, top: 2, left: FORM_LEFT + 12, width: 8, height: 3,
    border: { type: 'line' }, style: { border: { fg: 'cyan' }, focus: { border: { fg: 'yellow' } } },
    inputOnFocus: true, value: String(state.frameCount),
  });
  frameBox.on('submit', val => { state.frameCount = parseInt(val, 10) || state.frameCount; });

  // ── Target selector ────────────────────────────────────────────────────────
  blessed.text({ parent: container, top: 6, left: FORM_LEFT, content: 'Export Target:' });
  const targetList = blessed.list({
    parent: container, top: 7, left: FORM_LEFT, width: 22, height: VALID_TARGETS.length + 2,
    label: ' Target ', border: { type: 'line' },
    style: { selected: { bg: 'blue' }, border: { fg: 'cyan' } },
    items: VALID_TARGETS, keys: true, mouse: true,
  });
  targetList.select(VALID_TARGETS.indexOf(state.target));
  targetList.on('select item', (_, idx) => { state.target = VALID_TARGETS[idx]; });

  // ── Status display ─────────────────────────────────────────────────────────
  const statusBox = blessed.box({
    parent: container, bottom: 4, left: 2, right: 2, height: 3,
    border: { type: 'line' }, style: { border: { fg: 'cyan' } },
    content: 'Ready.', tags: true,
  });

  function setStatus(msg, isError = false) {
    statusBox.setContent(isError ? `{red-fg}${msg}{/red-fg}` : `{green-fg}${msg}{/green-fg}`);
    container.screen && container.screen.render();
  }

  // ── Generate button ────────────────────────────────────────────────────────
  const generateBtn = blessed.button({
    parent: container, bottom: 1, left: 2, width: 16, height: 3,
    content: ' [ Generate ] ', border: { type: 'line' },
    style: { border: { fg: 'green' }, focus: { border: { fg: 'yellow' } }, hover: { bg: 'green' } },
    mouse: true, keys: true,
  });
  generateBtn.on('press', async () => {
    try {
      const opts = parseFormValues(state);
      setStatus('Generating…');
      const result = await onGenerate(opts, config.getLibraryPath() || process.cwd());
      if (result.success) {
        setStatus(`✓ Saved ${result.filePaths.length} file(s)`);
      } else {
        setStatus(result.error, true);
      }
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  // ── Random button ──────────────────────────────────────────────────────────
  const randomBtn = blessed.button({
    parent: container, bottom: 1, left: 22, width: 20, height: 3,
    content: ' [ Random Wave ] ', border: { type: 'line' },
    style: { border: { fg: 'magenta' }, focus: { border: { fg: 'yellow' } }, hover: { bg: 'magenta' } },
    mouse: true, keys: true,
  });
  randomBtn.on('press', async () => {
    try {
      setStatus('Generating random wavetable…');
      const result = await onGenerateRandom(
        state.complexity,
        state.frameCount,
        config.getLibraryPath() || process.cwd()
      );
      if (result.success) {
        setStatus(`✓ Random wave saved to ${result.filePaths.length} file(s)`);
      } else {
        setStatus(result.error, true);
      }
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  panel.append(container);
  return container;
}

module.exports = {
  parseFormValues,
  buildFilename,
  onGenerate,
  onGenerateRandom,
  createGeneratorScreen,
  VALID_TARGETS,
};

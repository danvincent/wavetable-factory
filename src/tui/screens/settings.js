'use strict';

const fs = require('fs-extra');
const path = require('path');
const blessed = require('blessed');

// ── Business logic ────────────────────────────────────────────────────────────

/**
 * Validate and persist a new library path.
 * @param {string} rawPath - user-entered path (may have surrounding whitespace)
 * @param {object} config  - config module with setLibraryPath()
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function onSavePath(rawPath, config) {
  const newPath = rawPath.trim();

  if (!newPath) {
    return { success: false, message: 'Path is required — cannot be empty.' };
  }

  // Create the directory if it doesn't exist, then validate it is a directory
  try {
    await fs.ensureDir(newPath);
  } catch (err) {
    return { success: false, message: `Could not create directory: ${err.message}` };
  }

  let stat;
  try {
    stat = await fs.stat(newPath);
  } catch (err) {
    return { success: false, message: `Path does not exist: ${newPath}` };
  }

  if (!stat.isDirectory()) {
    return { success: false, message: `Path must be a directory/folder: ${newPath}` };
  }

  config.setLibraryPath(newPath);
  return { success: true, message: `Library path saved: ${newPath}` };
}

// ── TUI screen ────────────────────────────────────────────────────────────────

/**
 * Create the Settings TUI screen.
 * @param {object} panel  - blessed box (content panel)
 * @param {object} config - config module
 * @returns {{ container: object, save: function }}
 */
function createSettingsScreen(panel, config) {
  const container = blessed.box({
    top: 0, left: 0, width: '100%', height: '100%',
    label: ' Settings ', style: { label: { fg: 'cyan' } },
  });

  // ── Labels ────────────────────────────────────────────────────────────────
  blessed.text({
    parent: container,
    top: 1, left: 2,
    content: 'Wavetable Library Path',
    style: { fg: 'cyan', bold: true },
  });

  blessed.text({
    parent: container,
    top: 2, left: 2, right: 2,
    content: 'Set the root folder where wavetables are stored.',
    style: { fg: 'grey' },
  });

  // ── Path input ────────────────────────────────────────────────────────────
  const pathInput = blessed.textbox({
    parent: container,
    top: 4, left: 2, right: 2, height: 3,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, focus: { border: { fg: 'yellow' } } },
    inputOnFocus: true,
    value: config.getLibraryPath ? config.getLibraryPath() : '',
  });

  // ── Save button ───────────────────────────────────────────────────────────
  const saveBtn = blessed.button({
    parent: container,
    top: 8, left: 2, width: 10, height: 3,
    content: '  Save  ',
    border: { type: 'line' },
    style: { focus: { bg: 'cyan', fg: 'black' }, border: { fg: 'green' } },
    mouse: true,
  });

  // ── Status message ────────────────────────────────────────────────────────
  const statusBox = blessed.box({
    parent: container,
    top: 12, left: 2, right: 2, height: 1,
    content: '',
    tags: true,
    style: { fg: 'white' },
  });

  // ── Current value display ─────────────────────────────────────────────────
  const currentLabel = blessed.text({
    parent: container,
    top: 14, left: 2, right: 2,
    content: `Current: ${config.getLibraryPath ? config.getLibraryPath() : '(not set)'}`,
    style: { fg: 'grey' },
  });

  blessed.text({
    parent: container,
    bottom: 0, left: 0, right: 0, height: 1,
    content: ' [Enter] Save  [Esc] Cancel  [Tab] Switch panel ',
    style: { fg: 'black', bg: 'cyan' },
  });

  function setStatus(msg, isError = false) {
    statusBox.setContent(isError ? `{red-fg}${msg}{/red-fg}` : `{green-fg}${msg}{/green-fg}`);
    if (container.screen) container.screen.render();
  }

  async function doSave(rawPath) {
    const result = await onSavePath(rawPath, config);
    if (result.success) {
      currentLabel.setContent(`Current: ${rawPath.trim()}`);
      setStatus(result.message, false);
    } else {
      setStatus(result.message, true);
    }
    return result;
  }

  // Wire save button
  saveBtn.on('press', () => {
    const val = pathInput.getValue ? pathInput.getValue() : '';
    doSave(val);
  });

  // Wire Enter key on input
  pathInput.key(['enter'], () => {
    const val = pathInput.getValue ? pathInput.getValue() : '';
    doSave(val);
  });

  // Focus path input on show
  container.on('show', () => { pathInput.focus(); });

  panel.append(container);

  return {
    container,
    /** Public save function for testing / external wiring. */
    save: (rawPath) => doSave(rawPath),
  };
}

module.exports = { onSavePath, createSettingsScreen };

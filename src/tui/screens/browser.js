'use strict';

const path = require('path');
const blessed = require('blessed');
const { scanLibrary, buildFileTree } = require('../../library/scanner');
const { renameFile, deleteFile } = require('../../library/fileOps');

// ── Pure logic ───────────────────────────────────────────────────────────────

/**
 * Format a file tree into display strings and a parallel fileMap array.
 * fileMap[i] is the file object for that list row, or null for header rows.
 *
 * @param {{ ableton: Array, polyend: Array, other: Array }} tree
 * @returns {{ items: string[], fileMap: Array<object|null> }}
 */
function formatTreeItems(tree) {
  const items = [];
  const fileMap = [];

  function addSection(label, files) {
    items.push(`── ${label} (${files.length}) ──`);
    fileMap.push(null);
    for (const file of files) {
      items.push(`  ${file.name}`);
      fileMap.push(file);
    }
  }

  addSection('ABLETON', tree.ableton);
  addSection('POLYEND', tree.polyend);
  if (tree.other.length > 0) {
    addSection('OTHER', tree.other);
  }

  return { items, fileMap };
}

/**
 * Return the file object at the given list index, or null if it's a header/OOB.
 * @param {Array<object|null>} fileMap
 * @param {number} index
 * @returns {object|null}
 */
function getFileAtIndex(fileMap, index) {
  if (index < 0 || index >= fileMap.length) return null;
  return fileMap[index];
}

/**
 * Scan the library and build a formatted tree.
 * @param {string} libraryPath
 * @returns {Promise<{ tree, items, fileMap }>}
 */
async function loadTree(libraryPath) {
  const files = await scanLibrary(libraryPath);
  const tree = buildFileTree(files);
  const { items, fileMap } = formatTreeItems(tree);
  return { tree, items, fileMap };
}

/**
 * Rename a wavetable file within its current directory.
 * Appends .wav if missing. Rejects empty names.
 *
 * @param {string} filePath - absolute path to existing file
 * @param {string} newName - just the filename (no directory)
 * @returns {Promise<{ success: boolean, newPath?: string, error?: string }>}
 */
async function onRename(filePath, newName) {
  if (!newName || !newName.trim()) {
    return { success: false, error: 'Name cannot be empty' };
  }
  try {
    const dir = path.dirname(filePath);
    const finalName = newName.toLowerCase().endsWith('.wav') ? newName : `${newName}.wav`;
    const newPath = path.join(dir, finalName);
    await renameFile(filePath, newPath);
    return { success: true, newPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a wavetable file.
 * @param {string} filePath
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function onDelete(filePath) {
  try {
    const deleted = await deleteFile(filePath);
    return { success: deleted };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a file path to the player screen via callback.
 * @param {string} filePath
 * @param {function} [callback]
 */
function onSendToPlayer(filePath, callback) {
  if (typeof callback === 'function') {
    callback(filePath);
  }
}

// ── TUI screen ───────────────────────────────────────────────────────────────

/**
 * Create the Browser TUI screen.
 * @param {object} panel - blessed box (content panel)
 * @param {object} config - app config
 * @param {{ onLoadPlayer?: function }} [opts]
 * @returns {object} container box
 */
function createBrowserScreen(panel, config, opts = {}) {
  const container = blessed.box({
    top: 0, left: 0, width: '100%', height: '100%',
    label: ' Browser ',
    style: { label: { fg: 'cyan' } },
  });

  // ── Help bar ──────────────────────────────────────────────────────────────
  const helpText = blessed.text({
    parent: container,
    bottom: 0, left: 0, right: 0, height: 1,
    content: ' [r] Rename  [d] Delete  [p] Send to Player  [F5] Refresh ',
    style: { fg: 'black', bg: 'cyan' },
  });

  // ── Status line ───────────────────────────────────────────────────────────
  const statusBox = blessed.box({
    parent: container,
    bottom: 1, left: 0, right: 0, height: 1,
    content: '',
    tags: true,
    style: { fg: 'white' },
  });

  function setStatus(msg, isError = false) {
    statusBox.setContent(isError ? `{red-fg}${msg}{/red-fg}` : `{green-fg}${msg}{/green-fg}`);
    refresh();
  }

  // ── File list ─────────────────────────────────────────────────────────────
  const fileList = blessed.list({
    parent: container,
    top: 0, left: 0, right: 0, bottom: 2,
    label: ' Library ',
    border: { type: 'line' },
    style: {
      selected: { bg: 'blue', fg: 'white' },
      border: { fg: 'cyan' },
      label: { fg: 'cyan' },
      item: { fg: 'white' },
    },
    keys: true,
    mouse: true,
    scrollable: true,
    scrollbar: { ch: '│', style: { fg: 'cyan' } },
    items: ['Loading…'],
  });

  let currentFileMap = [];

  function getSelected() {
    const idx = fileList.selected || 0;
    return getFileAtIndex(currentFileMap, idx);
  }

  // ── Rename overlay ────────────────────────────────────────────────────────
  const renameBox = blessed.textbox({
    parent: container,
    bottom: 2, left: 2, width: 40, height: 3,
    label: ' New name: ',
    border: { type: 'line' },
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow' } },
    inputOnFocus: true,
    hidden: true,
  });

  renameBox.on('submit', async (val) => {
    renameBox.hide();
    const file = getSelected();
    if (!file) return;
    const result = await onRename(file.path, val);
    if (result.success) {
      setStatus(`✓ Renamed to ${path.basename(result.newPath)}`);
      await refresh();
    } else {
      setStatus(result.error || 'Rename failed', true);
    }
  });
  renameBox.on('cancel', () => { renameBox.hide(); refresh(); });

  // ── Confirm delete overlay ────────────────────────────────────────────────
  const confirmBox = blessed.box({
    parent: container,
    bottom: 2, left: 2, width: 50, height: 5,
    label: ' Confirm Delete ',
    border: { type: 'line' },
    style: { border: { fg: 'red' }, label: { fg: 'red' } },
    content: '\n  Delete this file? [y] Yes  [n] No',
    tags: true,
    hidden: true,
  });

  confirmBox.key(['y', 'Y'], async () => {
    confirmBox.hide();
    const file = getSelected();
    if (!file) return;
    const result = await onDelete(file.path);
    if (result.success) {
      setStatus('✓ Deleted');
      await refresh();
    } else {
      setStatus(result.error || 'Delete failed', true);
    }
  });
  confirmBox.key(['n', 'N', 'escape'], () => { confirmBox.hide(); refresh(); });

  // ── Keybindings ───────────────────────────────────────────────────────────
  fileList.key(['r'], () => {
    const file = getSelected();
    if (!file) return;
    renameBox.setValue(file.name);
    renameBox.show();
    renameBox.focus();
    refresh();
  });

  fileList.key(['d'], () => {
    const file = getSelected();
    if (!file) return;
    confirmBox.show();
    confirmBox.focus();
    refresh();
  });

  fileList.key(['p'], () => {
    const file = getSelected();
    if (!file) return;
    onSendToPlayer(file.path, opts.onLoadPlayer);
    setStatus(`→ Sent to Player: ${file.name}`);
  });

  fileList.key(['f5'], () => { refresh(); });

  // ── Refresh ───────────────────────────────────────────────────────────────
  async function refresh() {
    const libPath = config.getLibraryPath();
    if (!libPath) {
      fileList.setItems(['  No library path set. Go to Settings (4).']);
      currentFileMap = [null];
    } else {
      try {
        const { items, fileMap } = await loadTree(libPath);
        fileList.setItems(items);
        currentFileMap = fileMap;
      } catch (err) {
        fileList.setItems([`  Error loading library: ${err.message}`]);
        currentFileMap = [null];
      }
    }
    if (container.screen) container.screen.render();
  }

  // Trigger initial load when screen is shown
  container.on('show', () => refresh());

  panel.append(container);
  return container;
}

module.exports = {
  formatTreeItems,
  getFileAtIndex,
  loadTree,
  onRename,
  onDelete,
  onSendToPlayer,
  createBrowserScreen,
};

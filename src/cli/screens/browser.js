'use strict';

const path = require('path');
const fs   = require('fs-extra');

const { ask, printHeader, printSuccess, printError, printInfo, hr } = require('../prompt');
const { scanLibrary } = require('../../library/scanner');

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayList(files) {
  if (files.length === 0) {
    printInfo('  (no wavetables found)');
    return;
  }
  files.forEach((f, i) => {
    const rel = f.relativePath || path.basename(f.path);
    printInfo(`  ${i + 1}) ${rel}`);
  });
}

// ── Action menu for a selected file ──────────────────────────────────────────

async function fileMenu(file) {
  while (true) {
    hr();
    printInfo(`Selected: ${path.basename(file.path)}`);
    printInfo('  r) Rename');
    printInfo('  d) Delete');
    printInfo('  0) Back');
    hr();
    const sel = await ask('Action');
    if (sel === '0') break;

    if (sel === 'r' || sel === 'R') {
      const newName = await ask('New filename (without extension)');
      if (!newName || !newName.trim()) {
        printError('Name cannot be empty.');
        continue;
      }
      const dir = path.dirname(file.path);
      const ext = path.extname(file.path);
      const newPath = path.join(dir, newName.trim() + ext);
      try {
        await fs.rename(file.path, newPath);
        file.path = newPath;
        printSuccess(`Renamed to ${newName.trim()}${ext}`);
      } catch (err) {
        printError(`Rename failed: ${err.message}`);
      }
      break;
    }

    if (sel === 'd' || sel === 'D') {
      const confirm = await ask(`Delete "${path.basename(file.path)}"? (y/N)`);
      if (confirm.toLowerCase() === 'y') {
        try {
          await fs.unlink(file.path);
          printSuccess('Deleted.');
          return true; // signal "refresh needed"
        } catch (err) {
          printError(`Delete failed: ${err.message}`);
        }
      } else {
        printInfo('Cancelled.');
      }
      break;
    }

    printError('Unknown action. Enter r, d, or 0.');
  }
  return false;
}

// ── Main browser loop ─────────────────────────────────────────────────────────

async function browserMenu(config) {
  while (true) {
    printHeader('Wavetable Browser');
    const libraryPath = config.getLibraryPath();
    if (!libraryPath) {
      printError('Library path not configured. Please set it in Settings.');
      await ask('Press Enter to continue');
      return;
    }

    const files = await scanLibrary(libraryPath);
    displayList(files);
    hr();
    printInfo(`  0) Back`);
    hr();

    const sel = await ask('Select a wavetable');
    if (sel === '0') break;

    const idx = parseInt(sel, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= files.length) {
      printError('Invalid selection.');
      continue;
    }

    await fileMenu(files[idx]);
  }
}

module.exports = { browserMenu, fileMenu, displayList };

'use strict';

const path = require('path');
const fs   = require('fs-extra');

const { choose, ask, confirm, printHeader, printSuccess, printError, printInfo, hr } = require('../prompt');
const { scanLibrary } = require('../../library/scanner');
const { playerMenu }  = require('./player');

// ── Action menu for a selected file ──────────────────────────────────────────

async function fileMenu(file) {
  while (true) {
    hr();
    printInfo(`Selected: ${path.basename(file.path)}`);

    const ACTION_OPTIONS = ['Play', 'Rename', 'Delete', 'Back'];
    const action = await choose('Action', ACTION_OPTIONS);

    if (action === 3) break; // Back

    if (action === 0) { // Play
      await playerMenu(file.path);
      break;
    }

    if (action === 1) { // Rename
      const newName = await ask('New filename (without extension)');
      if (!newName || !newName.trim()) {
        printError('Name cannot be empty.');
        continue;
      }
      const dir     = path.dirname(file.path);
      const ext     = path.extname(file.path);
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

    if (action === 2) { // Delete
      const ok = await confirm(`Delete "${path.basename(file.path)}"?`);
      if (ok) {
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

    if (files.length === 0) {
      printInfo('(no wavetables found)');
      const back = await choose('', ['Back']);
      break;
    }

    const fileChoices = [
      ...files.map(f => f.relativePath || path.basename(f.path)),
      'Back',
    ];
    const sel = await choose('Select a wavetable', fileChoices);

    if (sel === files.length) break; // Back

    await fileMenu(files[sel]);
  }
}

module.exports = { browserMenu, fileMenu };

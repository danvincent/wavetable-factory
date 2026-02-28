'use strict';

const fs = require('fs-extra');
const { choose, ask, printHeader, printSuccess, printError, printInfo } = require('../prompt');

async function settingsMenu(config) {
  while (true) {
    printHeader('Settings');
    const current = config.getLibraryPath() || '(not set)';
    printInfo(`Library path: ${current}`);
    console.log('');

    const idx = await choose('Settings', ['Change library path', 'Back']);
    if (idx === 1) break;

    // Change library path
    const newPath = await ask('New library path');
    if (!newPath || !newPath.trim()) {
      printError('Path cannot be empty.');
      continue;
    }
    try {
      await fs.ensureDir(newPath.trim());
      config.setLibraryPath(newPath.trim());
      printSuccess(`Library path set to: ${newPath.trim()}`);
    } catch (err) {
      printError(`Could not create directory: ${err.message}`);
    }
  }
}

module.exports = { settingsMenu };

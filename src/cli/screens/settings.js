'use strict';

const fs = require('fs-extra');
const { ask, printHeader, printSuccess, printError, printInfo, hr } = require('../prompt');

async function settingsMenu(config) {
  while (true) {
    printHeader('Settings');
    const current = config.getLibraryPath() || '(not set)';
    printInfo(`  Library path: ${current}\n`);
    printInfo('  1) Change library path');
    printInfo('  0) Back');
    hr();

    const sel = await ask('Select');
    if (sel === '0') break;

    if (sel === '1') {
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
      continue;
    }

    printError('Invalid selection.');
  }
}

module.exports = { settingsMenu };

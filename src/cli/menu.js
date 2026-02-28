'use strict';

const { choose, printBanner } = require('./prompt');
const { generatorMenu } = require('./screens/generator');
const { browserMenu }   = require('./screens/browser');
const { settingsMenu }  = require('./screens/settings');

const MENU_ITEMS = [
  { label: 'Generate Wavetable', fn: (cfg) => generatorMenu(cfg) },
  { label: 'Browse Library',     fn: (cfg) => browserMenu(cfg)   },
  { label: 'Settings',           fn: (cfg) => settingsMenu(cfg)  },
  { label: 'Quit',               fn: null                        },
];

/**
 * Main application menu loop.
 * @param {object} config - app config module
 */
async function mainMenu(config) {
  while (true) {
    printBanner();
    const idx = await choose('Main Menu', MENU_ITEMS);
    const item = MENU_ITEMS[idx];
    if (!item || !item.fn) break;
    await item.fn(config);
  }
}

module.exports = { mainMenu };

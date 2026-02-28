'use strict';

const chalk = require('chalk');
const { ask, printBanner, printError } = require('./prompt');
const { generatorMenu } = require('./screens/generator');
const { browserMenu }   = require('./screens/browser');
const { settingsMenu }  = require('./screens/settings');

const MENU_ITEMS = [
  { key: '1', label: 'Generate Wavetable', fn: (cfg) => generatorMenu(cfg) },
  { key: '2', label: 'Browse Library',     fn: (cfg) => browserMenu(cfg)   },
  { key: '3', label: 'Settings',           fn: (cfg) => settingsMenu(cfg)  },
];

/**
 * Print the main menu and return the selected choice string.
 */
function printMainMenu() {
  printBanner();
  MENU_ITEMS.forEach(item => {
    console.log(`  ${chalk.yellow(item.key)}  ${chalk.white(item.label)}`);
  });
  console.log(`  ${chalk.yellow('0')}  ${chalk.grey('Quit')}`);
  console.log('');
}

/**
 * Main application menu loop.
 * @param {object} config - app config module
 */
async function mainMenu(config) {
  while (true) {
    printMainMenu();
    const choice = await ask('');

    if (choice === '0') break;

    const item = MENU_ITEMS.find(i => i.key === choice);
    if (item) {
      await item.fn(config);
    }
    // Unknown input: loop silently
  }
}

module.exports = { mainMenu };

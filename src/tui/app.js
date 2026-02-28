'use strict';

const blessed = require('blessed');
const { createLayout, MENU_ITEMS, updateMenuBar } = require('./layout');
const { registerGlobalKeys, SCREEN_ORDER } = require('./keybindings');
const { createScreenRegistry } = require('./screens/index');
const config = require('../config');
const { createGeneratorScreen } = require('./screens/generator');
const { createBrowserScreen } = require('./screens/browser');
const { createPlayerScreen } = require('./screens/player');
const { createSettingsScreen } = require('./screens/settings');

/**
 * Create the main application instance.
 * @returns {{ start(): void, navigate(name): void, screen: object }}
 */
function createApp() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Wavetable Factory',
    fullUnicode: true,
    forceUnicode: true,
  });

  const { menuBar, content } = createLayout(screen);
  const registry = createScreenRegistry(content);

  // Build all real screens and register them
  const generatorContainer = createGeneratorScreen(content, config);
  registry.register('generator', generatorContainer);

  const playerScreen = createPlayerScreen(content);
  registry.register('player', playerScreen.container);

  const browserContainer = createBrowserScreen(content, config, {
    onLoadPlayer: (filePath) => {
      navigate('player');
      playerScreen.loadFile(filePath);
    },
  });
  registry.register('browser', browserContainer);

  const settingsScreen = createSettingsScreen(content, config);
  registry.register('settings', settingsScreen.container);

  let currentScreen = 'generator';
  let currentSidebarIndex = 0;

  function navigate(name) {
    const idx = SCREEN_ORDER.indexOf(name);
    if (idx === -1) return;
    currentScreen = name;
    currentSidebarIndex = idx;
    registry.show(name);
    updateMenuBar(menuBar, name);
    screen.render();
  }

  function cyclePanel() {
    const next = (SCREEN_ORDER.indexOf(currentScreen) + 1) % SCREEN_ORDER.length;
    navigate(SCREEN_ORDER[next]);
  }

  function quit() {
    screen.destroy();
    process.exit(0);
  }

  registerGlobalKeys(screen, { quit, navigate, cyclePanel });

  function start() {
    navigate('generator');
    screen.render();
  }

  return { start, navigate, screen, registry };
}

module.exports = { createApp };

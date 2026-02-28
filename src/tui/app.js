'use strict';

const blessed = require('blessed');
const { createLayout, SIDEBAR_ITEMS } = require('./layout');
const { registerGlobalKeys, SCREEN_ORDER } = require('./keybindings');
const { createScreenRegistry } = require('./screens/index');

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

  const { sidebar, content } = createLayout(screen);
  const registry = createScreenRegistry(content);

  let currentScreen = 'generator';
  let currentSidebarIndex = 0;

  function navigate(name) {
    const idx = SCREEN_ORDER.indexOf(name);
    if (idx === -1) return;
    currentScreen = name;
    currentSidebarIndex = idx;
    registry.show(name);
    sidebar.select(idx);
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

  // Sidebar click navigation
  sidebar.on('select', (_, index) => {
    navigate(SCREEN_ORDER[index]);
  });

  function start() {
    navigate('generator');
    screen.render();
  }

  return { start, navigate, screen, registry };
}

module.exports = { createApp };

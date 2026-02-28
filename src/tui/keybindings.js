'use strict';

/**
 * Keybinding map:
 * Direct screen shortcuts: '1'–'4' map to screen names.
 * Action keys: quit, cyclePanel.
 */
const KEY_MAP = {
  quit: ['q', 'C-c'],
  cyclePanel: ['tab'],
  '1': 'generator',
  '2': 'browser',
  '3': 'player',
  '4': 'settings',
};

const SCREEN_ORDER = ['generator', 'browser', 'player', 'settings'];

/**
 * Register all global key handlers on the blessed screen.
 * @param {object} screen - blessed screen instance
 * @param {{ quit, navigate, cyclePanel }} handlers
 */
function registerGlobalKeys(screen, handlers) {
  screen.key(KEY_MAP.quit, () => handlers.quit());
  screen.key(KEY_MAP.cyclePanel, () => handlers.cyclePanel());
  screen.key(['1'], () => handlers.navigate('generator'));
  screen.key(['2'], () => handlers.navigate('browser'));
  screen.key(['3'], () => handlers.navigate('player'));
  screen.key(['4'], () => handlers.navigate('settings'));
}

module.exports = { KEY_MAP, SCREEN_ORDER, registerGlobalKeys };

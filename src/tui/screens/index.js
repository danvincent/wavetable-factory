'use strict';

const blessed = require('blessed');

/**
 * Create a placeholder panel for a screen that hasn't been implemented yet.
 * Each phase will replace these with real screen implementations.
 * @param {object} parent - parent content box
 * @param {string} title
 * @returns {object} blessed box
 */
function createPlaceholder(parent, title) {
  const box = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    content: `\n  ${title}\n  (coming soon)`,
    style: { fg: 'white' },
  });
  parent.append(box);
  return box;
}

/**
 * Build the screen registry — maps screen names to their widgets.
 * Screens start hidden; call show(name) to activate one.
 * @param {object} contentPanel - the main content blessed box
 * @returns {{ show(name): void, get(name): object, names: string[] }}
 */
function createScreenRegistry(contentPanel) {
  const screens = {
    generator: createPlaceholder(contentPanel, 'Generator'),
    browser: createPlaceholder(contentPanel, 'Browser'),
    player: createPlaceholder(contentPanel, 'Player'),
    settings: createPlaceholder(contentPanel, 'Settings'),
  };

  // Hide all initially
  for (const screen of Object.values(screens)) {
    screen.hide();
  }

  return {
    names: Object.keys(screens),

    show(name) {
      for (const [key, widget] of Object.entries(screens)) {
        if (key === name) {
          widget.show();
        } else {
          widget.hide();
        }
      }
    },

    get(name) {
      return screens[name];
    },

    /** Replace a screen's widget (used by Phases 5–8 to inject real screens) */
    register(name, widget) {
      if (screens[name]) {
        screens[name].destroy();
      }
      screens[name] = widget;
    },
  };
}

module.exports = { createScreenRegistry };

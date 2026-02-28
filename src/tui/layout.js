'use strict';

const blessed = require('blessed');

const SIDEBAR_ITEMS = [
  ' [1] Generator',
  ' [2] Browser',
  ' [3] Player',
  ' [4] Settings',
];

const SIDEBAR_WIDTH = 20;

/**
 * Create and append the sidebar list widget.
 * @param {object} screen - blessed screen
 * @returns {object} blessed list widget
 */
function createSidebar(screen) {
  const sidebar = blessed.list({
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    label: ' Navigation ',
    border: { type: 'line' },
    style: {
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'white' },
      border: { fg: 'cyan' },
      label: { fg: 'cyan' },
    },
    items: SIDEBAR_ITEMS,
    keys: false,
    mouse: true,
    scrollable: false,
  });
  screen.append(sidebar);
  return sidebar;
}

/**
 * Create and append the main content panel box.
 * @param {object} screen - blessed screen
 * @returns {object} blessed box widget
 */
function createContentPanel(screen) {
  const content = blessed.box({
    top: 0,
    left: SIDEBAR_WIDTH,
    width: `100%-${SIDEBAR_WIDTH}`,
    height: '100%',
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' },
    },
    scrollable: false,
  });
  screen.append(content);
  return content;
}

/**
 * Create the full layout: sidebar + content panel.
 * @param {object} screen - blessed screen
 * @returns {{ sidebar, content }}
 */
function createLayout(screen) {
  const sidebar = createSidebar(screen);
  const content = createContentPanel(screen);
  return { sidebar, content };
}

module.exports = { createLayout, createSidebar, createContentPanel, SIDEBAR_ITEMS, SIDEBAR_WIDTH };

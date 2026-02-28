'use strict';

const blessed = require('blessed');

// ── Constants ─────────────────────────────────────────────────────────────────

const TITLE_HEIGHT = 1;
const MENU_HEIGHT = 1;
const HELP_HEIGHT = 1;

/** Label and shortcut key for each screen in the menu bar. */
const MENU_ITEMS = [
  { name: 'generator', label: 'Generator', key: '1' },
  { name: 'browser',   label: 'Browser',   key: '2' },
  { name: 'player',    label: 'Player',     key: '3' },
  { name: 'settings',  label: 'Settings',   key: '4' },
];

const CONTENT_TOP = TITLE_HEIGHT + MENU_HEIGHT;
const CONTENT_HEIGHT = `100%-${CONTENT_TOP + HELP_HEIGHT}`;

// ── Title bar ─────────────────────────────────────────────────────────────────

/**
 * Create the 1-row title bar at the very top of the screen.
 * @param {object} screen - blessed screen
 * @returns {object} blessed box
 */
function createTitleBar(screen) {
  const bar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: TITLE_HEIGHT,
    tags: false,
    content: '  \u266a Wavetable Factory',
    style: { bg: 'blue', fg: 'white', bold: true },
  });
  screen.append(bar);
  return bar;
}

// ── Menu bar ──────────────────────────────────────────────────────────────────

/**
 * Build the menu bar content string, highlighting the active screen.
 * @param {string} activeName
 * @returns {string} blessed-tagged string
 */
function buildMenuContent(activeName) {
  return MENU_ITEMS.map(({ name, label, key }) => {
    const text = ` [${key}] ${label} `;
    return name === activeName
      ? `{black-fg}{cyan-bg}${text}{/cyan-bg}{/black-fg}`
      : `{white-fg}${text}{/white-fg}`;
  }).join('{grey-fg}\u2502{/grey-fg}');
}

/**
 * Create the horizontal menu bar (below the title bar).
 * @param {object} screen - blessed screen
 * @returns {object} blessed box
 */
function createMenuBar(screen) {
  const bar = blessed.box({
    top: TITLE_HEIGHT,
    left: 0,
    width: '100%',
    height: MENU_HEIGHT,
    tags: true,
    content: buildMenuContent('generator'),
    style: { bg: 'black' },
  });
  screen.append(bar);
  return bar;
}

/**
 * Update the menu bar to highlight the active screen.
 * @param {object} menuBar - blessed box returned by createMenuBar
 * @param {string} activeName - the active screen name
 */
function updateMenuBar(menuBar, activeName) {
  menuBar.setContent(buildMenuContent(activeName));
}

// ── Help bar ──────────────────────────────────────────────────────────────────

/**
 * Create the 1-row help/hint bar at the very bottom of the screen.
 * @param {object} screen - blessed screen
 * @returns {object} blessed box
 */
function createHelpBar(screen) {
  const bar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: HELP_HEIGHT,
    tags: true,
    content: ' {grey-fg}[q]{/grey-fg} Quit  {grey-fg}[Tab]{/grey-fg} Cycle  {grey-fg}[1-4]{/grey-fg} Jump',
    style: { bg: 'black' },
  });
  screen.append(bar);
  return bar;
}

// ── Content panel ─────────────────────────────────────────────────────────────

/**
 * Create the main content panel (fills space between menu and help bars).
 * @param {object} screen - blessed screen
 * @returns {object} blessed box
 */
function createContentPanel(screen) {
  const content = blessed.box({
    top: CONTENT_TOP,
    left: 0,
    width: '100%',
    height: CONTENT_HEIGHT,
    style: { bg: 'black' },
    scrollable: false,
  });
  screen.append(content);
  return content;
}

// ── Full layout ───────────────────────────────────────────────────────────────

/**
 * Create the complete application layout.
 * @param {object} screen - blessed screen
 * @returns {{ titleBar, menuBar, content, helpBar }}
 */
function createLayout(screen) {
  const titleBar = createTitleBar(screen);
  const menuBar  = createMenuBar(screen);
  const content  = createContentPanel(screen);
  const helpBar  = createHelpBar(screen);
  return { titleBar, menuBar, content, helpBar };
}

module.exports = {
  createLayout,
  createTitleBar,
  createMenuBar,
  updateMenuBar,
  createHelpBar,
  createContentPanel,
  MENU_ITEMS,
  MENU_HEIGHT,
  TITLE_HEIGHT,
  HELP_HEIGHT,
};

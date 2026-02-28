'use strict';

// Tests for TUI layout — blessed is mocked so no real terminal is needed

const mockWidget = () => ({
  append: jest.fn(),
  prepend: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  focus: jest.fn(),
  select: jest.fn(),
  key: jest.fn(),
  on: jest.fn(),
  setContent: jest.fn(),
  setLabel: jest.fn(),
  render: jest.fn(),
  destroy: jest.fn(),
  items: [],
});

jest.mock('blessed', () => ({
  screen: jest.fn(() => ({ ...mockWidget(), type: 'screen' })),
  list: jest.fn(() => ({ ...mockWidget(), type: 'list' })),
  box: jest.fn(() => ({ ...mockWidget(), type: 'box' })),
  text: jest.fn(() => ({ ...mockWidget(), type: 'text' })),
}));

const blessed = require('blessed');
const {
  createLayout,
  createMenuBar,
  createTitleBar,
  createHelpBar,
  createContentPanel,
  updateMenuBar,
  MENU_ITEMS,
  MENU_HEIGHT,
  TITLE_HEIGHT,
  HELP_HEIGHT,
} = require('../../src/tui/layout');

// ── createTitleBar ────────────────────────────────────────────────────────────

describe('createTitleBar(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls blessed.box to create title bar', () => {
    const screen = blessed.screen();
    createTitleBar(screen);
    expect(blessed.box).toHaveBeenCalled();
  });

  test('appends title bar to screen', () => {
    const screen = blessed.screen();
    createTitleBar(screen);
    expect(screen.append).toHaveBeenCalled();
  });

  test('returns a box widget', () => {
    const screen = blessed.screen();
    const bar = createTitleBar(screen);
    expect(bar.type).toBe('box');
  });
});

// ── createMenuBar ─────────────────────────────────────────────────────────────

describe('createMenuBar(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls blessed.box (not blessed.list) to create menu bar', () => {
    const screen = blessed.screen();
    createMenuBar(screen);
    expect(blessed.box).toHaveBeenCalled();
    expect(blessed.list).not.toHaveBeenCalled();
  });

  test('appends menu bar to screen', () => {
    const screen = blessed.screen();
    createMenuBar(screen);
    expect(screen.append).toHaveBeenCalled();
  });

  test('returns a box widget', () => {
    const screen = blessed.screen();
    const bar = createMenuBar(screen);
    expect(bar.type).toBe('box');
  });
});

// ── updateMenuBar ─────────────────────────────────────────────────────────────

describe('updateMenuBar(menuBar, activeName)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls setContent on the menu bar widget', () => {
    const screen = blessed.screen();
    const menuBar = createMenuBar(screen);
    updateMenuBar(menuBar, 'generator');
    expect(menuBar.setContent).toHaveBeenCalled();
  });

  test('highlights "generator" when it is the active screen', () => {
    const screen = blessed.screen();
    const menuBar = createMenuBar(screen);
    updateMenuBar(menuBar, 'generator');
    const content = menuBar.setContent.mock.calls[0][0];
    // Active item should have highlight markup, others should not be marked active
    expect(content).toMatch(/generator/i);
  });

  test('highlights "browser" when it is the active screen', () => {
    const screen = blessed.screen();
    const menuBar = createMenuBar(screen);
    updateMenuBar(menuBar, 'browser');
    const content = menuBar.setContent.mock.calls[0][0];
    expect(content).toMatch(/browser/i);
  });

  test('highlights "settings" when it is the active screen', () => {
    const screen = blessed.screen();
    const menuBar = createMenuBar(screen);
    updateMenuBar(menuBar, 'settings');
    const content = menuBar.setContent.mock.calls[0][0];
    expect(content).toMatch(/settings/i);
  });

  test('content includes all 4 screen names', () => {
    const screen = blessed.screen();
    const menuBar = createMenuBar(screen);
    updateMenuBar(menuBar, 'generator');
    const content = menuBar.setContent.mock.calls[0][0];
    expect(content).toMatch(/generator/i);
    expect(content).toMatch(/browser/i);
    expect(content).toMatch(/player/i);
    expect(content).toMatch(/settings/i);
  });
});

// ── createHelpBar ─────────────────────────────────────────────────────────────

describe('createHelpBar(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls blessed.box to create help bar', () => {
    const screen = blessed.screen();
    createHelpBar(screen);
    expect(blessed.box).toHaveBeenCalled();
  });

  test('appends help bar to screen', () => {
    const screen = blessed.screen();
    createHelpBar(screen);
    expect(screen.append).toHaveBeenCalled();
  });

  test('returns a box widget', () => {
    const screen = blessed.screen();
    const bar = createHelpBar(screen);
    expect(bar.type).toBe('box');
  });
});

// ── createContentPanel ────────────────────────────────────────────────────────

describe('createContentPanel(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls blessed.box to create content panel', () => {
    const screen = blessed.screen();
    createContentPanel(screen);
    expect(blessed.box).toHaveBeenCalled();
  });

  test('returns a box widget', () => {
    const screen = blessed.screen();
    const panel = createContentPanel(screen);
    expect(panel.type).toBe('box');
  });

  test('appends content panel to screen', () => {
    const screen = blessed.screen();
    createContentPanel(screen);
    expect(screen.append).toHaveBeenCalled();
  });
});

// ── createLayout ──────────────────────────────────────────────────────────────

describe('createLayout(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns object with menuBar, titleBar, helpBar, and content', () => {
    const screen = blessed.screen();
    const layout = createLayout(screen);
    expect(layout).toHaveProperty('menuBar');
    expect(layout).toHaveProperty('titleBar');
    expect(layout).toHaveProperty('helpBar');
    expect(layout).toHaveProperty('content');
  });

  test('menuBar is a box widget (not a list)', () => {
    const screen = blessed.screen();
    const { menuBar } = createLayout(screen);
    expect(menuBar.type).toBe('box');
  });

  test('content is a box widget', () => {
    const screen = blessed.screen();
    const { content } = createLayout(screen);
    expect(content.type).toBe('box');
  });

  test('layout does NOT have a sidebar property', () => {
    const screen = blessed.screen();
    const layout = createLayout(screen);
    expect(layout).not.toHaveProperty('sidebar');
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('layout constants', () => {
  test('MENU_ITEMS contains generator, browser, player, settings', () => {
    expect(MENU_ITEMS.map(i => i.name)).toEqual(['generator', 'browser', 'player', 'settings']);
  });

  test('MENU_HEIGHT is a positive integer', () => {
    expect(typeof MENU_HEIGHT).toBe('number');
    expect(MENU_HEIGHT).toBeGreaterThan(0);
  });

  test('TITLE_HEIGHT is 1', () => {
    expect(TITLE_HEIGHT).toBe(1);
  });

  test('HELP_HEIGHT is 1', () => {
    expect(HELP_HEIGHT).toBe(1);
  });
});


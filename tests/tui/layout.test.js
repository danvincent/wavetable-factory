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
const { createLayout, createSidebar, createContentPanel } = require('../../src/tui/layout');

describe('createSidebar(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls blessed.list to create sidebar widget', () => {
    const screen = blessed.screen();
    createSidebar(screen);
    expect(blessed.list).toHaveBeenCalled();
  });

  test('returns a list widget', () => {
    const screen = blessed.screen();
    const sidebar = createSidebar(screen);
    expect(sidebar).toBeDefined();
    expect(sidebar.type).toBe('list');
  });

  test('appends sidebar to screen', () => {
    const screen = blessed.screen();
    createSidebar(screen);
    expect(screen.append).toHaveBeenCalled();
  });
});

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
    expect(panel).toBeDefined();
    expect(panel.type).toBe('box');
  });

  test('appends content panel to screen', () => {
    const screen = blessed.screen();
    createContentPanel(screen);
    expect(screen.append).toHaveBeenCalled();
  });
});

describe('createLayout(screen)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns object with sidebar and content properties', () => {
    const screen = blessed.screen();
    const layout = createLayout(screen);
    expect(layout).toHaveProperty('sidebar');
    expect(layout).toHaveProperty('content');
  });

  test('sidebar is a list widget', () => {
    const screen = blessed.screen();
    const { sidebar } = createLayout(screen);
    expect(sidebar.type).toBe('list');
  });

  test('content is a box widget', () => {
    const screen = blessed.screen();
    const { content } = createLayout(screen);
    expect(content.type).toBe('box');
  });
});

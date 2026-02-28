'use strict';

jest.mock('blessed', () => {
  const makeWidget = () => ({
    append: jest.fn(), hide: jest.fn(), show: jest.fn(), focus: jest.fn(),
    key: jest.fn(), on: jest.fn(), setContent: jest.fn(), setLabel: jest.fn(),
    render: jest.fn(), destroy: jest.fn(), select: jest.fn(), screen: null,
    getValue: jest.fn(() => ''), setValue: jest.fn(),
  });
  const b = {
    screen: jest.fn(makeWidget), box: jest.fn(makeWidget),
    list: jest.fn(makeWidget), text: jest.fn(makeWidget),
    button: jest.fn(makeWidget), textbox: jest.fn(makeWidget),
    form: jest.fn(makeWidget),
  };
  return b;
});

// Mock all screen modules so no real fs/audio ops happen
jest.mock('../../src/tui/screens/generator', () => ({
  createGeneratorScreen: jest.fn(() => ({ hide: jest.fn(), show: jest.fn(), destroy: jest.fn(), on: jest.fn(), key: jest.fn() })),
}));
jest.mock('../../src/tui/screens/browser', () => ({
  createBrowserScreen: jest.fn(() => ({ hide: jest.fn(), show: jest.fn(), destroy: jest.fn(), on: jest.fn(), key: jest.fn() })),
}));
jest.mock('../../src/tui/screens/player', () => ({
  createPlayerScreen: jest.fn(() => ({ container: { hide: jest.fn(), show: jest.fn(), destroy: jest.fn(), on: jest.fn(), key: jest.fn() }, loadFile: jest.fn(), state: {} })),
  renderWaveformASCII: jest.fn(() => []),
  createPlayerState: jest.fn(() => ({})),
}));
jest.mock('../../src/tui/screens/settings', () => ({
  createSettingsScreen: jest.fn(() => ({ container: { hide: jest.fn(), show: jest.fn(), destroy: jest.fn(), on: jest.fn(), key: jest.fn() }, save: jest.fn() })),
  onSavePath: jest.fn(),
}));
jest.mock('../../src/config', () => ({
  load: jest.fn(() => ({ libraryPath: '/tmp' })),
  save: jest.fn(),
  setLibraryPath: jest.fn(),
  getLibraryPath: jest.fn(() => '/tmp'),
}));

const { createApp } = require('../../src/tui/app');

describe('createApp() integration smoke test', () => {
  test('createApp() returns object without throwing', () => {
    expect(() => createApp()).not.toThrow();
  });

  test('app has navigate and start functions', () => {
    const app = createApp();
    expect(typeof app.navigate).toBe('function');
    expect(typeof app.start).toBe('function');
  });

  test('app has a blessed screen', () => {
    const app = createApp();
    expect(app.screen).toBeDefined();
  });

  test('navigate to each screen does not throw', () => {
    const app = createApp();
    expect(() => app.navigate('generator')).not.toThrow();
    expect(() => app.navigate('browser')).not.toThrow();
    expect(() => app.navigate('player')).not.toThrow();
    expect(() => app.navigate('settings')).not.toThrow();
  });

  test('navigating to unknown screen is a no-op', () => {
    const app = createApp();
    expect(() => app.navigate('nonexistent')).not.toThrow();
  });

  test('all 4 real screens are registered via screen factories', () => {
    const { createGeneratorScreen } = require('../../src/tui/screens/generator');
    const { createBrowserScreen } = require('../../src/tui/screens/browser');
    const { createPlayerScreen } = require('../../src/tui/screens/player');
    const { createSettingsScreen } = require('../../src/tui/screens/settings');
    createApp();
    expect(createGeneratorScreen).toHaveBeenCalled();
    expect(createBrowserScreen).toHaveBeenCalled();
    expect(createPlayerScreen).toHaveBeenCalled();
    expect(createSettingsScreen).toHaveBeenCalled();
  });
});

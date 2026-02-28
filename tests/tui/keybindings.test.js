'use strict';

const { KEY_MAP, registerGlobalKeys } = require('../../src/tui/keybindings');

describe('KEY_MAP', () => {
  test('defines quit keys including q and C-c', () => {
    expect(KEY_MAP.quit).toContain('q');
    expect(KEY_MAP.quit).toContain('C-c');
  });

  test('defines tab for cyclePanel', () => {
    expect(KEY_MAP.cyclePanel).toContain('tab');
  });

  test('defines 1 for generator screen', () => {
    expect(KEY_MAP['1']).toBe('generator');
  });

  test('defines 2 for browser screen', () => {
    expect(KEY_MAP['2']).toBe('browser');
  });

  test('defines 3 for player screen', () => {
    expect(KEY_MAP['3']).toBe('player');
  });

  test('defines 4 for settings screen', () => {
    expect(KEY_MAP['4']).toBe('settings');
  });
});

describe('registerGlobalKeys(screen, handlers)', () => {
  let screen;
  let registeredKeys;

  beforeEach(() => {
    registeredKeys = {};
    screen = {
      key: jest.fn((keys, cb) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) registeredKeys[k] = cb;
      }),
    };
  });

  test('registers quit handler for q', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    expect(registeredKeys['q']).toBeDefined();
    registeredKeys['q']();
    expect(handlers.quit).toHaveBeenCalledTimes(1);
  });

  test('registers quit handler for C-c', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    expect(registeredKeys['C-c']).toBeDefined();
    registeredKeys['C-c']();
    expect(handlers.quit).toHaveBeenCalledTimes(1);
  });

  test('registers tab for cyclePanel', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    registeredKeys['tab']();
    expect(handlers.cyclePanel).toHaveBeenCalledTimes(1);
  });

  test('registers 1 key to navigate to generator', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    registeredKeys['1']();
    expect(handlers.navigate).toHaveBeenCalledWith('generator');
  });

  test('registers 2 key to navigate to browser', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    registeredKeys['2']();
    expect(handlers.navigate).toHaveBeenCalledWith('browser');
  });

  test('registers 3 key to navigate to player', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    registeredKeys['3']();
    expect(handlers.navigate).toHaveBeenCalledWith('player');
  });

  test('registers 4 key to navigate to settings', () => {
    const handlers = { quit: jest.fn(), navigate: jest.fn(), cyclePanel: jest.fn() };
    registerGlobalKeys(screen, handlers);
    registeredKeys['4']();
    expect(handlers.navigate).toHaveBeenCalledWith('settings');
  });
});

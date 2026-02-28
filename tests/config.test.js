'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');

// Point config to a temp dir for isolated testing
const TMP_DIR = path.join(os.tmpdir(), 'wavetable-factory-test-' + process.pid);

// Must mock HOME before requiring config so it picks up our temp dir
let config;

beforeEach(() => {
  jest.resetModules();
  fs.removeSync(TMP_DIR);
  fs.ensureDirSync(TMP_DIR);
  // Override the home dir the module uses
  jest.spyOn(os, 'homedir').mockReturnValue(TMP_DIR);
  config = require('../src/config');
});

afterEach(() => {
  fs.removeSync(TMP_DIR);
  jest.restoreAllMocks();
});

describe('config.load()', () => {
  test('returns defaults when no settings file exists', () => {
    const settings = config.load();
    expect(settings).toEqual(expect.objectContaining({
      libraryPath: null,
      defaultComplexity: 5,
      defaultFrameCount: 64,
    }));
  });

  test('reads back previously saved settings', () => {
    config.save({ libraryPath: '/music/wavetables', defaultComplexity: 7, defaultFrameCount: 32 });
    const settings = config.load();
    expect(settings.libraryPath).toBe('/music/wavetables');
    expect(settings.defaultComplexity).toBe(7);
    expect(settings.defaultFrameCount).toBe(32);
  });
});

describe('config.save()', () => {
  test('persists settings to disk', () => {
    config.save({ libraryPath: '/test/path' });
    const settings = config.load();
    expect(settings.libraryPath).toBe('/test/path');
  });

  test('merges with existing settings on partial save', () => {
    config.save({ libraryPath: '/music/wavetables', defaultComplexity: 8 });
    config.save({ defaultFrameCount: 128 });
    const settings = config.load();
    expect(settings.libraryPath).toBe('/music/wavetables');
    expect(settings.defaultComplexity).toBe(8);
    expect(settings.defaultFrameCount).toBe(128);
  });
});

describe('config.setLibraryPath()', () => {
  test('updates and persists the library path', () => {
    config.setLibraryPath('/new/library');
    const settings = config.load();
    expect(settings.libraryPath).toBe('/new/library');
  });
});

describe('config.getLibraryPath()', () => {
  test('returns null when not set', () => {
    expect(config.getLibraryPath()).toBeNull();
  });

  test('returns the stored library path', () => {
    config.setLibraryPath('/my/wavetables');
    expect(config.getLibraryPath()).toBe('/my/wavetables');
  });
});

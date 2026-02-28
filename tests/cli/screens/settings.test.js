'use strict';

jest.mock('fs-extra', () => ({ ensureDir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/cli/prompt', () => ({
  ask:          jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  hr:           jest.fn(),
}));

const { ask, printSuccess, printError } = require('../../../src/cli/prompt');
const fs = require('fs-extra');
const { settingsMenu } = require('../../../src/cli/screens/settings');

const MOCK_CONFIG = {
  getLibraryPath:  jest.fn(() => '/lib'),
  setLibraryPath:  jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('settingsMenu(config)', () => {
  test('exits on 0', async () => {
    ask.mockResolvedValueOnce('0');
    await expect(settingsMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('shows current library path', async () => {
    const { printInfo } = require('../../../src/cli/prompt');
    ask.mockResolvedValueOnce('0');
    await settingsMenu(MOCK_CONFIG);
    expect(printInfo).toHaveBeenCalledWith(expect.stringMatching(/\/lib/));
  });

  test('shows (not set) when path is null', async () => {
    const cfg = { getLibraryPath: jest.fn(() => null), setLibraryPath: jest.fn() };
    const { printInfo } = require('../../../src/cli/prompt');
    ask.mockResolvedValueOnce('0');
    await settingsMenu(cfg);
    expect(printInfo).toHaveBeenCalledWith(expect.stringMatching(/not set/));
  });

  test('updates library path and creates directory', async () => {
    ask
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('/new/path')
      .mockResolvedValueOnce('0');
    await settingsMenu(MOCK_CONFIG);
    expect(fs.ensureDir).toHaveBeenCalledWith('/new/path');
    expect(MOCK_CONFIG.setLibraryPath).toHaveBeenCalledWith('/new/path');
    expect(printSuccess).toHaveBeenCalledWith(expect.stringMatching(/\/new\/path/));
  });

  test('shows error when path is empty', async () => {
    ask
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('0');
    await settingsMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/empty/i));
    expect(MOCK_CONFIG.setLibraryPath).not.toHaveBeenCalled();
  });

  test('shows error when directory cannot be created', async () => {
    fs.ensureDir.mockRejectedValueOnce(new Error('permission denied'));
    ask
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('/bad/path')
      .mockResolvedValueOnce('0');
    await settingsMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/permission denied/));
    expect(MOCK_CONFIG.setLibraryPath).not.toHaveBeenCalled();
  });

  test('shows error for unknown selection', async () => {
    ask.mockResolvedValueOnce('9').mockResolvedValueOnce('0');
    await settingsMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/invalid/i));
  });
});

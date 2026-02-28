'use strict';

jest.mock('../../../src/cli/prompt', () => ({
  choose:       jest.fn(),
  ask:          jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  hr:           jest.fn(),
}));

jest.mock('fs-extra', () => ({ ensureDir: jest.fn().mockResolvedValue(undefined) }));

const { choose, ask, printSuccess, printError } = require('../../../src/cli/prompt');
const fsExtra = require('fs-extra');
const { settingsMenu } = require('../../../src/cli/screens/settings');

const MOCK_CONFIG = {
  getLibraryPath: jest.fn(),
  setLibraryPath: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  MOCK_CONFIG.getLibraryPath.mockReturnValue('/lib');
});

describe('settingsMenu(config)', () => {
  test('shows current library path', async () => {
    choose.mockResolvedValueOnce(1); // Back
    await settingsMenu(MOCK_CONFIG);
    expect(MOCK_CONFIG.getLibraryPath).toHaveBeenCalled();
  });

  test('exits on Back selection', async () => {
    choose.mockResolvedValueOnce(1);
    await expect(settingsMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('updates library path on valid input', async () => {
    choose.mockResolvedValueOnce(0).mockResolvedValueOnce(1); // Change path, then Back
    ask.mockResolvedValueOnce('/new/path');
    await settingsMenu(MOCK_CONFIG);
    expect(fsExtra.ensureDir).toHaveBeenCalledWith('/new/path');
    expect(MOCK_CONFIG.setLibraryPath).toHaveBeenCalledWith('/new/path');
    expect(printSuccess).toHaveBeenCalled();
  });

  test('shows error on empty path', async () => {
    choose.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    ask.mockResolvedValueOnce('');
    await settingsMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/empty/i));
    expect(MOCK_CONFIG.setLibraryPath).not.toHaveBeenCalled();
  });

  test('shows error if directory creation fails', async () => {
    fsExtra.ensureDir.mockRejectedValueOnce(new Error('permission denied'));
    choose.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    ask.mockResolvedValueOnce('/bad/path');
    await settingsMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/permission denied/));
  });

  test('shows (not set) when no path configured', async () => {
    MOCK_CONFIG.getLibraryPath.mockReturnValue(null);
    choose.mockResolvedValueOnce(1);
    const { printInfo } = require('../../../src/cli/prompt');
    await settingsMenu(MOCK_CONFIG);
    expect(printInfo).toHaveBeenCalledWith(expect.stringMatching(/not set/));
  });
});


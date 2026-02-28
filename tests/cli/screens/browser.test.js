'use strict';

jest.mock('../../../src/library/scanner', () => ({ scanLibrary: jest.fn() }));
jest.mock('../../../src/cli/screens/player', () => ({ playerMenu: jest.fn() }));
jest.mock('fs-extra', () => ({
  rename: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/cli/prompt', () => ({
  choose:       jest.fn(),
  ask:          jest.fn(),
  confirm:      jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  hr:           jest.fn(),
}));

const { choose, ask, confirm, printSuccess, printError, printInfo } = require('../../../src/cli/prompt');
const { scanLibrary }  = require('../../../src/library/scanner');
const { playerMenu }   = require('../../../src/cli/screens/player');
const fsExtra          = require('fs-extra');
const { browserMenu, fileMenu } = require('../../../src/cli/screens/browser');

const MOCK_FILE  = { path: '/lib/ableton/foo-bar-table.wav', relativePath: 'ableton/foo-bar-table.wav' };
const MOCK_FILE2 = { path: '/lib/ableton/baz-qux-table.wav', relativePath: 'ableton/baz-qux-table.wav' };
const MOCK_CONFIG = { getLibraryPath: jest.fn(() => '/lib') };

beforeEach(() => {
  jest.clearAllMocks();
  playerMenu.mockResolvedValue(undefined);
  scanLibrary.mockResolvedValue([MOCK_FILE, MOCK_FILE2]);
});

// ── fileMenu ──────────────────────────────────────────────────────────────────

describe('fileMenu(file)', () => {
  test('opens player on Play', async () => {
    choose.mockResolvedValueOnce(0); // Play
    await fileMenu({ ...MOCK_FILE });
    expect(playerMenu).toHaveBeenCalledWith(MOCK_FILE.path);
  });

  test('returns false on Back', async () => {
    choose.mockResolvedValueOnce(3); // Back
    const result = await fileMenu({ ...MOCK_FILE });
    expect(result).toBe(false);
  });

  test('renames file on Rename', async () => {
    choose.mockResolvedValueOnce(1); // Rename
    ask.mockResolvedValueOnce('new-name');
    await fileMenu({ ...MOCK_FILE });
    expect(fsExtra.rename).toHaveBeenCalled();
    expect(printSuccess).toHaveBeenCalled();
  });

  test('shows error on empty rename', async () => {
    choose.mockResolvedValueOnce(1).mockResolvedValueOnce(3); // Rename, then Back
    ask.mockResolvedValueOnce('');
    await fileMenu({ ...MOCK_FILE });
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/empty/i));
    expect(fsExtra.rename).not.toHaveBeenCalled();
  });

  test('deletes file when confirmed', async () => {
    choose.mockResolvedValueOnce(2); // Delete
    confirm.mockResolvedValueOnce(true);
    const result = await fileMenu({ ...MOCK_FILE });
    expect(fsExtra.unlink).toHaveBeenCalledWith(MOCK_FILE.path);
    expect(result).toBe(true);
  });

  test('cancels delete when not confirmed', async () => {
    choose.mockResolvedValueOnce(2); // Delete
    confirm.mockResolvedValueOnce(false);
    await fileMenu({ ...MOCK_FILE });
    expect(fsExtra.unlink).not.toHaveBeenCalled();
    expect(printInfo).toHaveBeenCalledWith('Cancelled.');
  });

  test('shows error on rename failure', async () => {
    fsExtra.rename.mockRejectedValueOnce(new Error('no permission'));
    choose.mockResolvedValueOnce(1);
    ask.mockResolvedValueOnce('new-name');
    await fileMenu({ ...MOCK_FILE });
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/no permission/));
  });

  test('shows error on delete failure', async () => {
    fsExtra.unlink.mockRejectedValueOnce(new Error('locked'));
    choose.mockResolvedValueOnce(2); // Delete
    confirm.mockResolvedValueOnce(true);
    await fileMenu({ ...MOCK_FILE });
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/locked/));
  });
});

// ── browserMenu ───────────────────────────────────────────────────────────────

describe('browserMenu(config)', () => {
  test('shows error when library path not configured', async () => {
    const cfg = { getLibraryPath: jest.fn(() => null) };
    ask.mockResolvedValueOnce('');
    await browserMenu(cfg);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/library path/i));
  });

  test('exits on Back selection', async () => {
    // Back = index files.length = 2
    choose.mockResolvedValueOnce(2);
    await expect(browserMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('passes relative path to choose list', async () => {
    choose.mockResolvedValueOnce(2); // Back
    await browserMenu(MOCK_CONFIG);
    expect(choose).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['ableton/foo-bar-table.wav'])
    );
  });

  test('selects a file and shows file menu', async () => {
    choose
      .mockResolvedValueOnce(0)   // select first file
      .mockResolvedValueOnce(3)   // Back from fileMenu
      .mockResolvedValueOnce(2);  // Back from browserMenu
    await browserMenu(MOCK_CONFIG);
    expect(playerMenu).not.toHaveBeenCalled();
  });

  test('shows empty message when no files', async () => {
    scanLibrary.mockResolvedValueOnce([]);
    choose.mockResolvedValueOnce(0); // Back (only option)
    await browserMenu(MOCK_CONFIG);
    expect(printInfo).toHaveBeenCalledWith(expect.stringMatching(/no wavetables/i));
  });
});

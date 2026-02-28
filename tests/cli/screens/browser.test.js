'use strict';

jest.mock('../../../src/library/scanner', () => ({
  scanLibrary: jest.fn(),
}));
jest.mock('fs-extra', () => ({
  rename: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/cli/prompt', () => ({
  ask:          jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  hr:           jest.fn(),
}));

const { ask, printSuccess, printError } = require('../../../src/cli/prompt');
const { scanLibrary }                   = require('../../../src/library/scanner');
const fs                                = require('fs-extra');
const { browserMenu }                   = require('../../../src/cli/screens/browser');

const MOCK_FILES = [
  { path: '/lib/ableton/warm-wave-sine.wav',    relativePath: 'ableton/warm-wave-sine.wav' },
  { path: '/lib/polyend/cold-arc-random.wav',   relativePath: 'polyend/cold-arc-random.wav' },
];
const MOCK_CONFIG = { getLibraryPath: jest.fn(() => '/lib') };

beforeEach(() => {
  jest.clearAllMocks();
  scanLibrary.mockResolvedValue([...MOCK_FILES.map(f => ({ ...f }))]);
});

describe('browserMenu(config)', () => {
  test('exits on selection 0', async () => {
    ask.mockResolvedValueOnce('0');
    await expect(browserMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('shows error and returns when no library path configured', async () => {
    const cfg = { getLibraryPath: jest.fn(() => null) };
    ask.mockResolvedValueOnce('');
    await browserMenu(cfg);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/library path/i));
  });

  test('shows error for invalid file selection', async () => {
    ask.mockResolvedValueOnce('99').mockResolvedValueOnce('0');
    await browserMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/invalid/i));
  });

  test('back from file menu returns to browser', async () => {
    // select file 1 → back (0) → back (0 again)
    ask
      .mockResolvedValueOnce('1') // select file
      .mockResolvedValueOnce('0') // back from file menu
      .mockResolvedValueOnce('0'); // back from browser
    await browserMenu(MOCK_CONFIG);
    expect(printError).not.toHaveBeenCalled();
  });

  test('rename: prompts for new name and calls fs.rename', async () => {
    ask
      .mockResolvedValueOnce('1')       // select first file
      .mockResolvedValueOnce('r')       // rename action
      .mockResolvedValueOnce('new-name') // new filename
      .mockResolvedValueOnce('0');       // back from browser
    await browserMenu(MOCK_CONFIG);
    expect(fs.rename).toHaveBeenCalled();
    expect(printSuccess).toHaveBeenCalledWith(expect.stringMatching(/renamed/i));
  });

  test('rename: shows error if name is empty', async () => {
    ask
      .mockResolvedValueOnce('1')  // select file
      .mockResolvedValueOnce('r')  // rename
      .mockResolvedValueOnce('')   // empty name
      .mockResolvedValueOnce('0')  // back from file menu
      .mockResolvedValueOnce('0'); // back from browser
    await browserMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/empty/i));
    expect(fs.rename).not.toHaveBeenCalled();
  });

  test('delete: removes file on confirmation y', async () => {
    ask
      .mockResolvedValueOnce('1')  // select file
      .mockResolvedValueOnce('d')  // delete action
      .mockResolvedValueOnce('y')  // confirm
      .mockResolvedValueOnce('0'); // back from browser
    await browserMenu(MOCK_CONFIG);
    expect(fs.unlink).toHaveBeenCalled();
    expect(printSuccess).toHaveBeenCalledWith('Deleted.');
  });

  test('delete: does not remove file if not confirmed', async () => {
    ask
      .mockResolvedValueOnce('1')  // select file
      .mockResolvedValueOnce('d')  // delete action
      .mockResolvedValueOnce('n')  // cancel
      .mockResolvedValueOnce('0'); // back from browser
    await browserMenu(MOCK_CONFIG);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  test('unknown file menu action shows error and loops', async () => {
    ask
      .mockResolvedValueOnce('1')  // select file
      .mockResolvedValueOnce('x')  // unknown
      .mockResolvedValueOnce('0')  // back from file menu
      .mockResolvedValueOnce('0'); // back from browser
    await browserMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/unknown action/i));
  });
});

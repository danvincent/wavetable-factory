'use strict';

// Mock sub-menu modules — fns declared INSIDE factories (jest hoisting rule)
jest.mock('../../src/cli/screens/generator', () => ({
  generatorMenu: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/cli/screens/browser', () => ({
  browserMenu: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/cli/screens/settings', () => ({
  settingsMenu: jest.fn().mockResolvedValue(undefined),
}));

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

jest.mock('readline', () => {
  const state = { answers: [], idx: 0 };
  return {
    _setAnswers(arr) { state.answers = [...arr]; state.idx = 0; },
    createInterface: () => ({
      question: (q, cb) => {
        const a = state.idx < state.answers.length ? state.answers[state.idx++] : '0';
        setImmediate(() => cb(a));
      },
      close: () => {},
    }),
  };
});

jest.mock('../../src/cli/prompt', () => ({
  ask:          jest.fn(),
  choose:       jest.fn(),
  confirm:      jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  printBanner:  jest.fn(),
  hr:           jest.fn(),
  closeRL:      jest.fn(),
}));

const { ask } = require('../../src/cli/prompt');
const { generatorMenu } = require('../../src/cli/screens/generator');
const { browserMenu }   = require('../../src/cli/screens/browser');
const { settingsMenu }  = require('../../src/cli/screens/settings');
const { mainMenu } = require('../../src/cli/menu');

const MOCK_CONFIG = { getLibraryPath: jest.fn(() => '/tmp') };

beforeEach(() => jest.clearAllMocks());

describe('mainMenu(config)', () => {
  test('calls generatorMenu when user selects 1', async () => {
    ask.mockResolvedValueOnce('1').mockResolvedValueOnce('0');
    await mainMenu(MOCK_CONFIG);
    expect(generatorMenu).toHaveBeenCalledWith(MOCK_CONFIG);
  });

  test('calls browserMenu when user selects 2', async () => {
    ask.mockResolvedValueOnce('2').mockResolvedValueOnce('0');
    await mainMenu(MOCK_CONFIG);
    expect(browserMenu).toHaveBeenCalled();
  });

  test('calls settingsMenu when user selects 3', async () => {
    ask.mockResolvedValueOnce('3').mockResolvedValueOnce('0');
    await mainMenu(MOCK_CONFIG);
    expect(settingsMenu).toHaveBeenCalledWith(MOCK_CONFIG);
  });

  test('exits loop on selection 0', async () => {
    ask.mockResolvedValueOnce('0');
    await expect(mainMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('ignores unknown input and loops again', async () => {
    ask.mockResolvedValueOnce('9').mockResolvedValueOnce('0');
    await mainMenu(MOCK_CONFIG);
    expect(generatorMenu).not.toHaveBeenCalled();
    expect(browserMenu).not.toHaveBeenCalled();
  });

  test('loops multiple times before exiting', async () => {
    ask.mockResolvedValueOnce('1').mockResolvedValueOnce('2').mockResolvedValueOnce('0');
    await mainMenu(MOCK_CONFIG);
    expect(generatorMenu).toHaveBeenCalledTimes(1);
    expect(browserMenu).toHaveBeenCalledTimes(1);
  });
});

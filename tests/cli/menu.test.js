'use strict';

jest.mock('../../src/cli/prompt', () => ({
  choose:       jest.fn(),
  ask:          jest.fn(),
  printBanner:  jest.fn(),
  printError:   jest.fn(),
}));

jest.mock('../../src/cli/screens/generator', () => ({ generatorMenu: jest.fn() }));
jest.mock('../../src/cli/screens/browser',   () => ({ browserMenu:   jest.fn() }));
jest.mock('../../src/cli/screens/settings',  () => ({ settingsMenu:  jest.fn() }));

const { choose }       = require('../../src/cli/prompt');
const { generatorMenu } = require('../../src/cli/screens/generator');
const { browserMenu }   = require('../../src/cli/screens/browser');
const { settingsMenu }  = require('../../src/cli/screens/settings');
const { mainMenu }      = require('../../src/cli/menu');

const MOCK_CONFIG = {};

beforeEach(() => {
  jest.clearAllMocks();
  generatorMenu.mockResolvedValue(undefined);
  browserMenu.mockResolvedValue(undefined);
  settingsMenu.mockResolvedValue(undefined);
});

describe('mainMenu(config)', () => {
  test('navigates to generator on Generate Wavetable selection', async () => {
    choose.mockResolvedValueOnce(0).mockResolvedValueOnce(3); // Generator then Quit
    await mainMenu(MOCK_CONFIG);
    expect(generatorMenu).toHaveBeenCalledWith(MOCK_CONFIG);
  });

  test('navigates to browser on Browse Library selection', async () => {
    choose.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    await mainMenu(MOCK_CONFIG);
    expect(browserMenu).toHaveBeenCalledWith(MOCK_CONFIG);
  });

  test('navigates to settings on Settings selection', async () => {
    choose.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    await mainMenu(MOCK_CONFIG);
    expect(settingsMenu).toHaveBeenCalledWith(MOCK_CONFIG);
  });

  test('exits loop on Quit selection', async () => {
    choose.mockResolvedValueOnce(3);
    await expect(mainMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('loops back after a screen returns', async () => {
    choose.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    await mainMenu(MOCK_CONFIG);
    expect(generatorMenu).toHaveBeenCalledTimes(2);
  });
});


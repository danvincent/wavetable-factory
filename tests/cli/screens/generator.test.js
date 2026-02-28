'use strict';

jest.mock('../../../src/engine/generator',  () => ({ generateWavetable:       jest.fn() }));
jest.mock('../../../src/engine/randomizer', () => ({ generateRandomWavetable: jest.fn() }));
jest.mock('../../../src/engine/exporter',   () => ({
  exportForAbleton: jest.fn().mockResolvedValue(undefined),
  exportForPolyend: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('fs-extra', () => ({ ensureDir: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../../src/cli/prompt', () => ({
  choose:       jest.fn(),
  ask:          jest.fn(),
  askValidated: jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  hr:           jest.fn(),
}));

const { choose, ask, askValidated, printSuccess, printError } = require('../../../src/cli/prompt');
const { generateWavetable }      = require('../../../src/engine/generator');
const { generateRandomWavetable } = require('../../../src/engine/randomizer');
const { exportForAbleton, exportForPolyend } = require('../../../src/engine/exporter');
const { generatorMenu, generateName }        = require('../../../src/cli/screens/generator');

const FAKE_FRAMES = [new Float32Array(2048)];
const MOCK_CONFIG = { getLibraryPath: jest.fn(() => '/lib') };

// 10 waveform types (0-9), Random = 10, Back = 11
const BACK_IDX   = 11;
const RANDOM_IDX = 10;
const TARGET_BOTH = 2;

beforeEach(() => {
  jest.clearAllMocks();
  generateWavetable.mockReturnValue(FAKE_FRAMES);
  generateRandomWavetable.mockReturnValue(FAKE_FRAMES);
  askValidated.mockResolvedValue(String(5)); // default complexity
});

// ── generateName ──────────────────────────────────────────────────────────────

describe('generateName()', () => {
  test('returns string matching {word}-{word}-table pattern', () => {
    expect(generateName()).toMatch(/^[a-z]+-[a-z]+-table$/);
  });

  test('always ends with -table', () => {
    expect(generateName()).toMatch(/-table$/);
  });

  test('generates different names on subsequent calls (probabilistic)', () => {
    const names = new Set(Array.from({ length: 20 }, () => generateName()));
    expect(names.size).toBeGreaterThan(1);
  });
});

// ── generatorMenu ─────────────────────────────────────────────────────────────

describe('generatorMenu(config)', () => {
  test('exits on Back selection', async () => {
    choose.mockResolvedValueOnce(BACK_IDX);
    await expect(generatorMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('generates sine wavetable and exports to Ableton', async () => {
    choose
      .mockResolvedValueOnce(0)          // sine
      .mockResolvedValueOnce(0)          // Ableton
      .mockResolvedValueOnce(BACK_IDX);  // exit
    askValidated
      .mockResolvedValueOnce('5')        // complexity
      .mockResolvedValueOnce('64');      // frame count
    ask.mockResolvedValueOnce('');       // Press Enter to continue

    await generatorMenu(MOCK_CONFIG);

    expect(generateWavetable).toHaveBeenCalledWith(expect.objectContaining({ type: 'sine' }));
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).not.toHaveBeenCalled();
  });

  test('exports to Polyend when target=Polyend', async () => {
    choose
      .mockResolvedValueOnce(1)          // sawtooth
      .mockResolvedValueOnce(1)          // Polyend
      .mockResolvedValueOnce(BACK_IDX);
    askValidated
      .mockResolvedValueOnce('5')
      .mockResolvedValueOnce('64');
    ask.mockResolvedValueOnce('');

    await generatorMenu(MOCK_CONFIG);
    expect(exportForPolyend).toHaveBeenCalled();
    expect(exportForAbleton).not.toHaveBeenCalled();
  });

  test('exports both formats when target=Both', async () => {
    choose
      .mockResolvedValueOnce(0)          // sine
      .mockResolvedValueOnce(2)          // Both
      .mockResolvedValueOnce(BACK_IDX);
    askValidated
      .mockResolvedValueOnce('5')
      .mockResolvedValueOnce('64');
    ask.mockResolvedValueOnce('');

    await generatorMenu(MOCK_CONFIG);
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).toHaveBeenCalled();
  });

  test('calls generateRandomWavetable for Random selection', async () => {
    choose
      .mockResolvedValueOnce(RANDOM_IDX) // Random
      .mockResolvedValueOnce(TARGET_BOTH)
      .mockResolvedValueOnce(BACK_IDX);
    askValidated.mockResolvedValueOnce('7'); // complexity
    ask.mockResolvedValueOnce('');

    await generatorMenu(MOCK_CONFIG);
    expect(generateRandomWavetable).toHaveBeenCalled();
    expect(generateWavetable).not.toHaveBeenCalled();
  });

  test('defaults export target to Both', async () => {
    choose
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(TARGET_BOTH) // Both
      .mockResolvedValueOnce(BACK_IDX);
    askValidated
      .mockResolvedValueOnce('5')
      .mockResolvedValueOnce('64');
    ask.mockResolvedValueOnce('');

    await generatorMenu(MOCK_CONFIG);
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).toHaveBeenCalled();
  });

  test('prints error when library path not configured', async () => {
    const cfg = { getLibraryPath: jest.fn(() => null) };
    choose
      .mockResolvedValueOnce(0)          // sine
      .mockResolvedValueOnce(2)          // target: Both
      .mockResolvedValueOnce(BACK_IDX);  // exit after error
    askValidated
      .mockResolvedValueOnce('5')
      .mockResolvedValueOnce('64');

    await generatorMenu(cfg);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/library path/i));
    expect(exportForAbleton).not.toHaveBeenCalled();
  });

  test('uses custom complexity', async () => {
    choose
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(BACK_IDX);
    askValidated
      .mockResolvedValueOnce('8')   // complexity
      .mockResolvedValueOnce('64'); // frame count
    ask.mockResolvedValueOnce('');

    await generatorMenu(MOCK_CONFIG);
    expect(generateWavetable).toHaveBeenCalledWith(expect.objectContaining({ complexity: 8 }));
  });

  test('prints error on export failure', async () => {
    exportForAbleton.mockRejectedValueOnce(new Error('disk full'));
    choose
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(BACK_IDX);
    askValidated
      .mockResolvedValueOnce('5')
      .mockResolvedValueOnce('64');
    ask.mockResolvedValueOnce('');

    await generatorMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/disk full/));
  });
});

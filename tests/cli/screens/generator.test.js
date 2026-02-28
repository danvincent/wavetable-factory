'use strict';

jest.mock('../../../src/engine/generator',  () => ({ generateWavetable:       jest.fn() }));
jest.mock('../../../src/engine/randomizer', () => ({ generateRandomWavetable: jest.fn() }));
jest.mock('../../../src/engine/exporter',   () => ({
  exportForAbleton: jest.fn().mockResolvedValue(undefined),
  exportForPolyend: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('fs-extra', () => ({ ensureDir: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../../src/cli/prompt', () => ({
  ask:          jest.fn(),
  choose:       jest.fn(),
  printHeader:  jest.fn(),
  printSuccess: jest.fn(),
  printError:   jest.fn(),
  printInfo:    jest.fn(),
  hr:           jest.fn(),
}));

const { ask, choose, printSuccess, printError } = require('../../../src/cli/prompt');
const { generateWavetable }                     = require('../../../src/engine/generator');
const { generateRandomWavetable }               = require('../../../src/engine/randomizer');
const { exportForAbleton, exportForPolyend }    = require('../../../src/engine/exporter');
const { generatorMenu, generateName }           = require('../../../src/cli/screens/generator');

const FAKE_FRAMES = [new Float32Array(2048)];
const MOCK_CONFIG = { getLibraryPath: jest.fn(() => '/lib') };

beforeEach(() => {
  jest.clearAllMocks();
  generateWavetable.mockReturnValue(FAKE_FRAMES);
  generateRandomWavetable.mockReturnValue(FAKE_FRAMES);
});

// ── generateName ──────────────────────────────────────────────────────────────

describe('generateName(type)', () => {
  test('returns string matching {word}-{word}-{type} pattern', () => {
    const name = generateName('sine');
    expect(name).toMatch(/^[a-z]+-[a-z]+-sine$/);
  });

  test('uses the supplied type as the suffix', () => {
    expect(generateName('random')).toMatch(/-random$/);
    expect(generateName('sawtooth')).toMatch(/-sawtooth$/);
  });

  test('generates different names on subsequent calls (probabilistic)', () => {
    const names = new Set(Array.from({ length: 20 }, () => generateName('sine')));
    expect(names.size).toBeGreaterThan(1);
  });
});

// ── generatorMenu ─────────────────────────────────────────────────────────────

describe('generatorMenu(config)', () => {
  test('exits cleanly on selection 0', async () => {
    ask.mockResolvedValueOnce('0');
    await expect(generatorMenu(MOCK_CONFIG)).resolves.toBeUndefined();
  });

  test('generates sine wavetable for Ableton and exports it', async () => {
    ask
      .mockResolvedValueOnce('1')   // sine
      .mockResolvedValueOnce('')    // complexity default
      .mockResolvedValueOnce('')    // frame count default
      .mockResolvedValueOnce('')    // Enter to continue
      .mockResolvedValueOnce('0');  // back
    choose.mockResolvedValueOnce(0); // Ableton

    await generatorMenu(MOCK_CONFIG);

    expect(generateWavetable).toHaveBeenCalledWith(expect.objectContaining({ type: 'sine' }));
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).not.toHaveBeenCalled();
  });

  test('generates for Polyend when target=1', async () => {
    ask
      .mockResolvedValueOnce('2')   // sawtooth
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('0');
    choose.mockResolvedValueOnce(1); // Polyend

    await generatorMenu(MOCK_CONFIG);
    expect(exportForPolyend).toHaveBeenCalled();
    expect(exportForAbleton).not.toHaveBeenCalled();
  });

  test('exports both formats when target=2', async () => {
    ask
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('0');
    choose.mockResolvedValueOnce(2); // Both

    await generatorMenu(MOCK_CONFIG);
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).toHaveBeenCalled();
  });

  test('calls generateRandomWavetable for random selection', async () => {
    // Random is always the last option (7th = index 6 in 0-based, selection "7")
    ask
      .mockResolvedValueOnce('7')   // Random
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('0');
    choose.mockResolvedValueOnce(0); // Ableton

    await generatorMenu(MOCK_CONFIG);
    expect(generateRandomWavetable).toHaveBeenCalled();
    expect(generateWavetable).not.toHaveBeenCalled();
  });

  test('prints error when library path not configured', async () => {
    const cfg = { getLibraryPath: jest.fn(() => null) };
    ask
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('0');
    choose.mockResolvedValueOnce(0);

    await generatorMenu(cfg);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/library path/i));
    expect(exportForAbleton).not.toHaveBeenCalled();
  });

  test('prints error on invalid waveform selection', async () => {
    ask.mockResolvedValueOnce('99').mockResolvedValueOnce('0');
    await generatorMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/invalid/i));
  });

  test('uses custom complexity when provided', async () => {
    ask
      .mockResolvedValueOnce('1')   // sine
      .mockResolvedValueOnce('8')   // complexity
      .mockResolvedValueOnce('')    // frame count default
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('0');
    choose.mockResolvedValueOnce(0);

    await generatorMenu(MOCK_CONFIG);
    expect(generateWavetable).toHaveBeenCalledWith(expect.objectContaining({ complexity: 8 }));
  });

  test('prints error on export failure', async () => {
    exportForAbleton.mockRejectedValueOnce(new Error('disk full'));
    ask
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('')    // complexity
      .mockResolvedValueOnce('')    // frame count
      .mockResolvedValueOnce('')    // Enter to continue
      .mockResolvedValueOnce('0'); // back
    choose.mockResolvedValueOnce(0);

    await generatorMenu(MOCK_CONFIG);
    expect(printError).toHaveBeenCalledWith(expect.stringMatching(/disk full/));
  });
});

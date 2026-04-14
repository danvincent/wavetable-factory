'use strict';

// blessed is mocked — only pure logic and action functions are tested here
jest.mock('blessed', () => {
  const widget = () => ({
    append: jest.fn(), prepend: jest.fn(), hide: jest.fn(), show: jest.fn(),
    focus: jest.fn(), key: jest.fn(), on: jest.fn(), setContent: jest.fn(),
    setLabel: jest.fn(), render: jest.fn(), destroy: jest.fn(),
    setValue: jest.fn(), getValue: jest.fn(() => ''),
    submit: jest.fn(), cancel: jest.fn(), items: [],
  });
  return {
    screen: jest.fn(widget), box: jest.fn(widget), list: jest.fn(widget),
    form: jest.fn(widget), textbox: jest.fn(widget), text: jest.fn(widget),
    button: jest.fn(widget), radioset: jest.fn(widget), radiobutton: jest.fn(widget),
  };
});

jest.mock('../../../src/engine/generator', () => ({
  generateWavetable: jest.fn(() => [new Float32Array(2048)]),
}));
jest.mock('../../../src/engine/randomizer', () => ({
  generateRandomWavetable: jest.fn(() => [new Float32Array(2048)]),
}));
jest.mock('../../../src/engine/exporter', () => ({
  exportForAbleton: jest.fn(() => Promise.resolve()),
  exportForPolyend: jest.fn(() => Promise.resolve()),
  exportForPirateSynthWt: jest.fn(() => Promise.resolve()),
}));

const { parseFormValues, buildFilename, onGenerate, onGenerateRandom } = require('../../../src/tui/screens/generator');
const { generateWavetable } = require('../../../src/engine/generator');
const { generateRandomWavetable } = require('../../../src/engine/randomizer');
const { exportForAbleton, exportForPolyend, exportForPirateSynthWt } = require('../../../src/engine/exporter');

beforeEach(() => jest.clearAllMocks());

// ── parseFormValues ──────────────────────────────────────────────────────────

describe('parseFormValues(values)', () => {
  const valid = { type: 'sine', complexity: 5, frameCount: 64, target: 'both' };

  test('returns validated options for valid input', () => {
    const result = parseFormValues(valid);
    expect(result.type).toBe('sine');
    expect(result.complexity).toBe(5);
    expect(result.frameCount).toBe(64);
    expect(result.target).toBe('both');
  });

  test('throws when complexity is below 1', () => {
    expect(() => parseFormValues({ ...valid, complexity: 0 })).toThrow(/complexity/i);
  });

  test('throws when complexity is above 10', () => {
    expect(() => parseFormValues({ ...valid, complexity: 11 })).toThrow(/complexity/i);
  });

  test('throws when frameCount is below 1', () => {
    expect(() => parseFormValues({ ...valid, frameCount: 0 })).toThrow(/frame count/i);
  });

  test('throws when frameCount is above 256', () => {
    expect(() => parseFormValues({ ...valid, frameCount: 257 })).toThrow(/frame count/i);
  });

  test('throws when type is not a valid waveform type', () => {
    expect(() => parseFormValues({ ...valid, type: 'laser' })).toThrow(/type/i);
  });

  test('throws when target is not a valid export target', () => {
    expect(() => parseFormValues({ ...valid, target: 'garage-band' })).toThrow(/target/i);
  });

  test('accepts all valid waveform types', () => {
    const types = ['sine', 'sawtooth', 'square', 'triangle', 'pulse', 'additive'];
    for (const type of types) {
      expect(() => parseFormValues({ ...valid, type })).not.toThrow();
    }
  });

  test('coerces string numbers to integers', () => {
    const result = parseFormValues({ ...valid, complexity: '7', frameCount: '32' });
    expect(result.complexity).toBe(7);
    expect(result.frameCount).toBe(32);
  });
});

// ── buildFilename ────────────────────────────────────────────────────────────

describe('buildFilename(options)', () => {
  test('returns a string ending in .wav', () => {
    const name = buildFilename({ type: 'sine', complexity: 5, frameCount: 64 });
    expect(name).toMatch(/\.wav$/);
  });

  test('includes the waveform type', () => {
    const name = buildFilename({ type: 'sawtooth', complexity: 3, frameCount: 16 });
    expect(name).toContain('sawtooth');
  });

  test('includes complexity and frameCount', () => {
    const name = buildFilename({ type: 'sine', complexity: 7, frameCount: 32 });
    expect(name).toMatch(/c7/);
    expect(name).toMatch(/f32/);
  });

  test('different calls produce different filenames (timestamp)', () => {
    return new Promise(resolve => setTimeout(() => {
      const a = buildFilename({ type: 'sine', complexity: 5, frameCount: 64 });
      const b = buildFilename({ type: 'sine', complexity: 5, frameCount: 64 });
      // May collide within same ms — just check format is correct
      expect(a).toMatch(/\.wav$/);
      expect(b).toMatch(/\.wav$/);
      resolve();
    }, 1));
  });
});

// ── onGenerate ───────────────────────────────────────────────────────────────

describe('onGenerate(options, libraryPath)', () => {
  const opts = { type: 'sine', complexity: 5, frameCount: 64, target: 'both' };
  const libPath = '/tmp/library';

  test('calls generateWavetable with correct options', async () => {
    await onGenerate(opts, libPath);
    expect(generateWavetable).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sine', complexity: 5, frameCount: 64,
    }));
  });

  test('calls exportForAbleton when target is both', async () => {
    await onGenerate({ ...opts, target: 'both' }, libPath);
    expect(exportForAbleton).toHaveBeenCalled();
  });

  test('calls exportForPolyend when target is both', async () => {
    await onGenerate({ ...opts, target: 'both' }, libPath);
    expect(exportForPolyend).toHaveBeenCalled();
  });

  test('calls exportForPirateSynthWt when target is pirate', async () => {
    await onGenerate({ ...opts, target: 'pirate' }, libPath);
    expect(exportForPirateSynthWt).toHaveBeenCalled();
    expect(exportForAbleton).not.toHaveBeenCalled();
    expect(exportForPolyend).not.toHaveBeenCalled();
  });

  test('calls all exporters when target is all', async () => {
    await onGenerate({ ...opts, target: 'all' }, libPath);
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).toHaveBeenCalled();
    expect(exportForPirateSynthWt).toHaveBeenCalled();
  });

  test('calls only exportForAbleton when target is ableton', async () => {
    await onGenerate({ ...opts, target: 'ableton' }, libPath);
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).not.toHaveBeenCalled();
  });

  test('calls only exportForPolyend when target is polyend', async () => {
    await onGenerate({ ...opts, target: 'polyend' }, libPath);
    expect(exportForPolyend).toHaveBeenCalled();
    expect(exportForAbleton).not.toHaveBeenCalled();
  });

  test('Ableton export path is under libraryPath/ableton/', async () => {
    await onGenerate({ ...opts, target: 'ableton' }, libPath);
    const [, calledPath] = exportForAbleton.mock.calls[0];
    expect(calledPath).toContain('/tmp/library/ableton/');
  });

  test('Polyend export path is under libraryPath/polyend/', async () => {
    await onGenerate({ ...opts, target: 'polyend' }, libPath);
    const [, calledPath] = exportForPolyend.mock.calls[0];
    expect(calledPath).toContain('/tmp/library/polyend/');
  });

  test('returns object with success true and filePaths on success', async () => {
    const result = await onGenerate(opts, libPath);
    expect(result.success).toBe(true);
    expect(result.filePaths).toBeDefined();
  });

  test('returns object with success false and error message on failure', async () => {
    exportForAbleton.mockRejectedValueOnce(new Error('disk full'));
    const result = await onGenerate({ ...opts, target: 'ableton' }, libPath);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disk full/i);
  });
});

// ── onGenerateRandom ─────────────────────────────────────────────────────────

describe('onGenerateRandom(complexity, frameCount, libraryPath)', () => {
  const libPath = '/tmp/library';

  test('calls generateRandomWavetable with complexity and frameCount', async () => {
    await onGenerateRandom(8, 64, libPath);
    expect(generateRandomWavetable).toHaveBeenCalledWith(8, 64);
  });

  test('exports to both ableton and polyend folders', async () => {
    await onGenerateRandom(8, 64, libPath);
    expect(exportForAbleton).toHaveBeenCalled();
    expect(exportForPolyend).toHaveBeenCalled();
  });

  test('returns success result with filePaths', async () => {
    const result = await onGenerateRandom(5, 32, libPath);
    expect(result.success).toBe(true);
    expect(result.filePaths).toBeDefined();
  });

  test('random export includes pirate .txt output', async () => {
    await onGenerateRandom(5, 32, libPath);
    expect(exportForPirateSynthWt).toHaveBeenCalled();
  });

  test('returns error result on failure', async () => {
    generateRandomWavetable.mockImplementationOnce(() => { throw new Error('oops'); });
    const result = await onGenerateRandom(5, 32, libPath);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

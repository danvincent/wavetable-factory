'use strict';

const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

// ── ora mock ──────────────────────────────────────────────────────────────────
jest.mock('ora', () => {
  const spinner = { start: jest.fn(), succeed: jest.fn(), fail: jest.fn() };
  spinner.start.mockReturnValue(spinner);
  const factory = jest.fn(() => spinner);
  factory._spinner = spinner;
  return factory;
});

// ── figlet mock ───────────────────────────────────────────────────────────────
jest.mock('figlet', () => ({
  textSync: jest.fn(() => 'WAVETABLE FACTORY'),
}));

// ── readline mock ─────────────────────────────────────────────────────────────
jest.mock('readline', () => {
  const state = { answers: [], idx: 0 };
  return {
    _setAnswers(arr) { state.answers = [...arr]; state.idx = 0; },
    createInterface: () => ({
      question: (q, cb) => {
        const answer = state.idx < state.answers.length ? state.answers[state.idx++] : '';
        setImmediate(() => cb(answer));
      },
      close: () => {},
    }),
  };
});

const rl = require('readline');
const ora = require('ora');
const {
  ask, askValidated, choose, confirm,
  printHeader, printSuccess, printError, printInfo, printBanner,
  hr, closeRL, renderWaveform, withSpinner,
} = require('../../src/cli/prompt');

beforeEach(() => {
  closeRL();
  jest.clearAllMocks();
  // restore ora spinner mock state
  ora._spinner.start.mockReturnValue(ora._spinner);
});

// ── ask ───────────────────────────────────────────────────────────────────────

describe('ask(question)', () => {
  test('resolves with the trimmed answer', async () => {
    rl._setAnswers(['  hello world  ']);
    expect(await ask('Enter something:')).toBe('hello world');
  });

  test('resolves with empty string when user hits enter', async () => {
    rl._setAnswers(['']);
    expect(await ask('Enter something:')).toBe('');
  });
});

// ── askValidated ──────────────────────────────────────────────────────────────

describe('askValidated(label, validator, defaultVal)', () => {
  test('resolves immediately when validator returns null', async () => {
    rl._setAnswers(['42']);
    const result = await askValidated('Number', v => (isNaN(+v) ? 'must be number' : null));
    expect(result).toBe('42');
  });

  test('re-prompts once on bad input, then resolves on good input', async () => {
    rl._setAnswers(['bad', '5']);
    const result = await askValidated('Number', v => (isNaN(+v) ? 'must be number' : null));
    expect(result).toBe('5');
  });

  test('returns defaultVal string when empty and defaultVal provided', async () => {
    rl._setAnswers(['']); // user hits enter
    const result = await askValidated('Frames', v => null, '64');
    expect(result).toBe('64');
  });

  test('re-prompts multiple times until valid', async () => {
    rl._setAnswers(['a', 'b', '7']);
    const result = await askValidated('N', v => (isNaN(+v) ? 'err' : null));
    expect(result).toBe('7');
  });
});

// ── choose ────────────────────────────────────────────────────────────────────

describe('choose(label, options)', () => {
  const STRING_OPTIONS = ['Sine', 'Square', 'Sawtooth'];
  const OBJECT_OPTIONS = [
    { label: 'Sine',     value: 'sine'     },
    { label: 'Square',   value: 'square'   },
    { label: 'Sawtooth', value: 'sawtooth' },
  ];

  test('returns 0-based index for string options', async () => {
    rl._setAnswers(['2']);
    expect(await choose('Pick', STRING_OPTIONS)).toBe(1);
  });

  test('returns 0-based index for object options', async () => {
    rl._setAnswers(['3']);
    expect(await choose('Pick', OBJECT_OPTIONS)).toBe(2);
  });

  test('returns 0 when user selects first option', async () => {
    rl._setAnswers(['1']);
    expect(await choose('Pick', STRING_OPTIONS)).toBe(0);
  });

  test('re-prompts on out-of-range input then resolves', async () => {
    rl._setAnswers(['99', '2']);
    expect(await choose('Pick', STRING_OPTIONS)).toBe(1);
  });

  test('re-prompts on non-numeric input', async () => {
    rl._setAnswers(['abc', '1']);
    expect(await choose('Pick', STRING_OPTIONS)).toBe(0);
  });
});

// ── confirm ───────────────────────────────────────────────────────────────────

describe('confirm(question)', () => {
  test('returns true for "y"',  async () => { rl._setAnswers(['y']); expect(await confirm('Sure?')).toBe(true);  });
  test('returns true for "Y"',  async () => { rl._setAnswers(['Y']); expect(await confirm('Sure?')).toBe(true);  });
  test('returns false for "n"', async () => { rl._setAnswers(['n']); expect(await confirm('Sure?')).toBe(false); });
  test('returns false for "N"', async () => { rl._setAnswers(['N']); expect(await confirm('Sure?')).toBe(false); });
  test('returns false for empty (default no)', async () => { rl._setAnswers(['']); expect(await confirm('Sure?')).toBe(false); });
  test('re-prompts on unrecognised input then resolves', async () => {
    rl._setAnswers(['maybe', 'y']);
    expect(await confirm('Sure?')).toBe(true);
  });
});

// ── withSpinner ───────────────────────────────────────────────────────────────

describe('withSpinner(label, fn)', () => {
  test('calls fn and resolves with its return value', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const result = await withSpinner('Loading…', fn);
    expect(fn).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  test('calls spinner.start and spinner.succeed on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await withSpinner('Doing thing', fn);
    expect(ora._spinner.start).toHaveBeenCalled();
    expect(ora._spinner.succeed).toHaveBeenCalled();
  });

  test('calls spinner.fail and re-throws on error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(withSpinner('Doing thing', fn)).rejects.toThrow('boom');
    expect(ora._spinner.fail).toHaveBeenCalled();
  });
});

// ── renderWaveform ────────────────────────────────────────────────────────────

describe('renderWaveform(samples, width)', () => {
  const BLOCKS = '▁▂▃▄▅▆▇█';

  test('returns a string of exactly `width` characters', () => {
    const samples = new Float32Array(100).fill(0);
    const result = renderWaveform(samples, 40);
    expect([...result].length).toBe(40);
  });

  test('maps amplitude 0 (silence) to middle block character', () => {
    const samples = new Float32Array([0]);
    const result = renderWaveform(samples, 1);
    expect(result).toBe('▄');
  });

  test('maps amplitude +1 (full positive) to highest block ▇ or █', () => {
    const samples = new Float32Array([1]);
    const result = renderWaveform(samples, 1);
    expect(['▇', '█']).toContain(result);
  });

  test('maps amplitude -1 (full negative) to lowest block ▁', () => {
    const samples = new Float32Array([-1]);
    const result = renderWaveform(samples, 1);
    expect(result).toBe('▁');
  });

  test('all characters in result are valid block chars', () => {
    const samples = Float32Array.from({ length: 50 }, (_, i) =>
      Math.sin((2 * Math.PI * i) / 50)
    );
    const result = renderWaveform(samples, 20);
    for (const ch of result) {
      expect(BLOCKS).toContain(ch);
    }
  });
});

// ── print helpers ─────────────────────────────────────────────────────────────

describe('print helpers', () => {
  test('printHeader writes to stdout and contains the title', () => {
    printHeader('Test Title');
    expect(consoleSpy.mock.calls.flat().join(' ')).toMatch(/Test Title/);
  });

  test('printSuccess output contains the message', () => {
    printSuccess('Wavetable saved');
    expect(consoleSpy.mock.calls.flat().join(' ')).toMatch(/Wavetable saved/);
  });

  test('printError output contains the message', () => {
    printError('File not found');
    expect(consoleSpy.mock.calls.flat().join(' ')).toMatch(/File not found/);
  });

  test('printInfo output contains the message', () => {
    printInfo('Just so you know');
    expect(consoleSpy.mock.calls.flat().join(' ')).toMatch(/Just so you know/);
  });

  test('hr calls console.log', () => {
    hr();
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('printBanner calls console.log', () => {
    printBanner();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

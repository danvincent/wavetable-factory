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

// ── inquirer mock ─────────────────────────────────────────────────────────────
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

const inquirer = require('inquirer');
const ora = require('ora');
const {
  ask, askValidated, choose, confirm,
  printHeader, printSuccess, printError, printInfo, printBanner,
  hr, closeRL, renderWaveform, withSpinner,
} = require('../../src/cli/prompt');

beforeEach(() => {
  jest.clearAllMocks();
  ora._spinner.start.mockReturnValue(ora._spinner);
});

// ── ask ───────────────────────────────────────────────────────────────────────

describe('ask(question)', () => {
  test('resolves with the trimmed answer', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '  hello world  ' });
    expect(await ask('Enter something:')).toBe('hello world');
  });

  test('resolves with empty string when user hits enter', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '' });
    expect(await ask('Enter something:')).toBe('');
  });
});

// ── askValidated ──────────────────────────────────────────────────────────────

describe('askValidated(label, validator, defaultVal)', () => {
  test('resolves immediately when validator returns null', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '42' });
    const result = await askValidated('Number', v => (isNaN(+v) ? 'must be number' : null));
    expect(result).toBe('42');
  });

  test('passes validate function to inquirer', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '5' });
    await askValidated('Number', v => null);
    const config = inquirer.prompt.mock.calls[0][0][0];
    expect(typeof config.validate).toBe('function');
  });

  test('validate returns true for valid input', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '5' });
    await askValidated('Number', v => null);
    const { validate } = inquirer.prompt.mock.calls[0][0][0];
    expect(validate('5')).toBe(true);
  });

  test('validate returns error string for invalid input', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '5' });
    await askValidated('Number', v => (isNaN(+v) ? 'must be number' : null));
    const { validate } = inquirer.prompt.mock.calls[0][0][0];
    expect(validate('abc')).toBe('must be number');
  });

  test('passes default value to inquirer', async () => {
    inquirer.prompt.mockResolvedValue({ answer: '64' });
    await askValidated('Frames', v => null, '64');
    const config = inquirer.prompt.mock.calls[0][0][0];
    expect(config.default).toBe('64');
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
    inquirer.prompt.mockResolvedValue({ idx: 1 });
    expect(await choose('Pick', STRING_OPTIONS)).toBe(1);
  });

  test('returns 0-based index for object options', async () => {
    inquirer.prompt.mockResolvedValue({ idx: 2 });
    expect(await choose('Pick', OBJECT_OPTIONS)).toBe(2);
  });

  test('returns 0 when user selects first option', async () => {
    inquirer.prompt.mockResolvedValue({ idx: 0 });
    expect(await choose('Pick', STRING_OPTIONS)).toBe(0);
  });

  test('uses list type prompt', async () => {
    inquirer.prompt.mockResolvedValue({ idx: 0 });
    await choose('Pick', STRING_OPTIONS);
    expect(inquirer.prompt.mock.calls[0][0][0].type).toBe('list');
  });

  test('maps string options to choices with value=index', async () => {
    inquirer.prompt.mockResolvedValue({ idx: 0 });
    await choose('Pick', STRING_OPTIONS);
    const { choices } = inquirer.prompt.mock.calls[0][0][0];
    expect(choices[0]).toEqual({ name: 'Sine', value: 0 });
    expect(choices[2]).toEqual({ name: 'Sawtooth', value: 2 });
  });
});

// ── confirm ───────────────────────────────────────────────────────────────────

describe('confirm(question)', () => {
  test('returns true when user confirms', async () => {
    inquirer.prompt.mockResolvedValue({ answer: true });
    expect(await confirm('Sure?')).toBe(true);
  });

  test('returns false when user declines', async () => {
    inquirer.prompt.mockResolvedValue({ answer: false });
    expect(await confirm('Sure?')).toBe(false);
  });

  test('uses confirm type prompt', async () => {
    inquirer.prompt.mockResolvedValue({ answer: false });
    await confirm('Sure?');
    expect(inquirer.prompt.mock.calls[0][0][0].type).toBe('confirm');
  });

  test('defaults to false', async () => {
    inquirer.prompt.mockResolvedValue({ answer: false });
    await confirm('Sure?');
    expect(inquirer.prompt.mock.calls[0][0][0].default).toBe(false);
  });
});

// ── closeRL ───────────────────────────────────────────────────────────────────

describe('closeRL()', () => {
  test('does not throw', () => {
    expect(() => closeRL()).not.toThrow();
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

  test('maps amplitude 0 (silence) to a mid-range block character', () => {
    const samples = new Float32Array([0]);
    const result = renderWaveform(samples, 1);
    expect(['▄', '▅']).toContain(result);
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

'use strict';

const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

// ── readline mock ─────────────────────────────────────────────────────────────
// State lives INSIDE the factory (required by Jest hoisting rules).
// Tests set answers via require('readline')._setAnswers([...]).

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
const { ask, choose, confirm, printHeader, printSuccess, printError, printInfo, hr, closeRL } =
  require('../../src/cli/prompt');

beforeEach(() => {
  closeRL(); // reset singleton so next ask() creates a fresh RL with the new answers
  jest.clearAllMocks();
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

// ── choose ────────────────────────────────────────────────────────────────────

describe('choose(label, options)', () => {
  const OPTIONS = [
    { value: 'sine',     label: 'Sine'     },
    { value: 'square',   label: 'Square'   },
    { value: 'sawtooth', label: 'Sawtooth' },
  ];

  test('returns the chosen option on valid numeric input', async () => {
    rl._setAnswers(['2']);
    expect(await choose('Pick a wave', OPTIONS)).toEqual(OPTIONS[1]);
  });

  test('returns first option when user enters 1', async () => {
    rl._setAnswers(['1']);
    expect(await choose('Pick a wave', OPTIONS)).toEqual(OPTIONS[0]);
  });

  test('re-prompts then resolves after out-of-range input', async () => {
    rl._setAnswers(['99', '3']);
    expect(await choose('Pick a wave', OPTIONS)).toEqual(OPTIONS[2]);
  });

  test('re-prompts on non-numeric input', async () => {
    rl._setAnswers(['abc', '1']);
    expect(await choose('Pick a wave', OPTIONS)).toEqual(OPTIONS[0]);
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
});


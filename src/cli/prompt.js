'use strict';

const readline = require('readline');
const chalk    = require('chalk');
const figlet   = require('figlet');
const ora      = require('ora');

// ── Readline singleton ────────────────────────────────────────────────────────

let _rl = null;

function getRL() {
  if (!_rl) {
    _rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return _rl;
}

function closeRL() {
  if (_rl) { _rl.close(); _rl = null; }
}

// ── ask ───────────────────────────────────────────────────────────────────────

function ask(question) {
  return new Promise(resolve => {
    const prompt = question
      ? chalk.cyan('▶ ') + chalk.bold.white(question) + ' '
      : chalk.cyan('▶ ');
    getRL().question(prompt, answer => resolve(answer.trim()));
  });
}

// ── askValidated ──────────────────────────────────────────────────────────────

/**
 * Ask a question and validate the answer inline.
 * Re-prompts (showing error in-place) until validator returns null.
 * If the user hits Enter with no input and defaultVal is provided, returns defaultVal.
 * @param {string} label
 * @param {(value: string) => string|null} validator - returns error string or null for valid
 * @param {string} [defaultVal]
 * @returns {Promise<string>}
 */
async function askValidated(label, validator, defaultVal) {
  const displayLabel = defaultVal !== undefined
    ? `${label} ${chalk.dim(`[${defaultVal}]`)}`
    : label;

  while (true) {
    const raw = await ask(displayLabel);
    const value = raw === '' && defaultVal !== undefined ? defaultVal : raw;
    const error = validator(value);
    if (error === null) return value;
    printError(error);
  }
}

// ── choose ────────────────────────────────────────────────────────────────────

/**
 * Print a numbered list and resolve with the 0-based index of the selection.
 * Accepts string[] or {label, value}[] — always returns index.
 * @param {string} label
 * @param {string[]|{label:string,value:any}[]} options
 * @returns {Promise<number>}
 */
async function choose(label, options) {
  console.log('');
  console.log(chalk.bold.white(label));
  options.forEach((opt, i) => {
    const text = typeof opt === 'string' ? opt : opt.label;
    console.log(`  ${chalk.yellow(String(i + 1))}  ${chalk.white(text)}`);
  });
  console.log('');

  while (true) {
    const raw = await ask('Enter number:');
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= options.length) return n - 1;
    printError(`Please enter a number between 1 and ${options.length}`);
  }
}

// ── confirm ───────────────────────────────────────────────────────────────────

async function confirm(question) {
  while (true) {
    const raw = await ask(`${question} ${chalk.dim('[y/N]')}`);
    if (raw === '' || raw.toLowerCase() === 'n') return false;
    if (raw.toLowerCase() === 'y') return true;
    printError('Please enter y or n');
  }
}

// ── withSpinner ───────────────────────────────────────────────────────────────

/**
 * Run an async function with an ora spinner.
 * @param {string} label
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
async function withSpinner(label, fn) {
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    throw err;
  }
}

// ── renderWaveform ────────────────────────────────────────────────────────────

const BLOCKS = '▁▂▃▄▅▆▇█';

/**
 * Render a Float32Array of samples as a single-row block-character waveform.
 * Amplitude -1 → ▁, 0 → ▄, +1 → █. Returns a string of exactly `width` chars.
 * @param {Float32Array} samples
 * @param {number} width
 * @returns {string}
 */
function renderWaveform(samples, width) {
  const n = BLOCKS.length; // 8
  let result = '';
  for (let col = 0; col < width; col++) {
    // Map column → sample index (downsample or upsample)
    const sampleIdx = Math.min(
      samples.length - 1,
      Math.floor((col / width) * samples.length)
    );
    const amp = Math.max(-1, Math.min(1, samples[sampleIdx]));
    // amp in [-1,1] → block index in [0, n-1]
    const blockIdx = Math.min(n - 1, Math.floor(((amp + 1) / 2) * (n - 1) + 0.5));
    result += BLOCKS[blockIdx];
  }
  return result;
}

// ── Print helpers ─────────────────────────────────────────────────────────────

const BOX_W = 52;

function printBanner() {
  const art = figlet.textSync('Wavetable', { font: 'Small' });
  console.log('');
  console.log(chalk.blueBright(art));
  console.log(chalk.dim('  ♪  factory  ·  synthesise · browse · play'));
  console.log('');
}

function printHeader(title) {
  const bar = chalk.blueBright('─'.repeat(BOX_W));
  console.log('');
  console.log(bar);
  console.log(chalk.bold.white(`  ${title}`));
  console.log(bar);
  console.log('');
}

function printSuccess(msg) {
  console.log(chalk.green('  ✔  ') + chalk.greenBright(msg));
}

function printError(msg) {
  console.log(chalk.red('  ✖  ') + chalk.redBright(msg));
}

function printInfo(msg) {
  console.log(chalk.white('  ' + msg));
}

function hr() {
  console.log(chalk.dim('─'.repeat(BOX_W)));
}

module.exports = {
  ask,
  askValidated,
  choose,
  confirm,
  withSpinner,
  renderWaveform,
  printBanner,
  printHeader,
  printSuccess,
  printError,
  printInfo,
  hr,
  closeRL,
};

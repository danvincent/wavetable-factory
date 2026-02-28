'use strict';

const chalk    = require('chalk');
const figlet   = require('figlet');
const ora      = require('ora');
const inquirer = require('inquirer');

// ── closeRL ───────────────────────────────────────────────────────────────────
// Inquirer manages its own readline instance. closeRL() is kept as a no-op so
// player.js can call it before entering raw stdin mode without breaking anything.

function closeRL() {}

// ── ask ───────────────────────────────────────────────────────────────────────

async function ask(question) {
  const { answer } = await inquirer.prompt([{
    type:    'input',
    name:    'answer',
    message: chalk.bold.white(question),
    prefix:  chalk.cyan('▶'),
  }]);
  return answer.trim();
}

// ── askValidated ──────────────────────────────────────────────────────────────

/**
 * Ask a question and validate the answer inline.
 * Inquirer re-prompts automatically when validate() returns a string.
 * @param {string} label
 * @param {(value: string) => string|null} validator - returns error string or null for valid
 * @param {string} [defaultVal]
 * @returns {Promise<string>}
 */
async function askValidated(label, validator, defaultVal) {
  const { answer } = await inquirer.prompt([{
    type:     'input',
    name:     'answer',
    message:  chalk.bold.white(label),
    prefix:   chalk.cyan('▶'),
    default:  defaultVal,
    validate: value => {
      const err = validator(value ?? '');
      return err === null ? true : err;
    },
  }]);
  return answer;
}

// ── choose ────────────────────────────────────────────────────────────────────

/**
 * Show an arrow-key list and resolve with the 0-based index of the selection.
 * @param {string} label
 * @param {string[]|{label:string,value:any}[]} options
 * @param {number} [defaultIndex=0]
 * @returns {Promise<number>}
 */
async function choose(label, options, defaultIndex = 0) {
  const choices = options.map((opt, i) => ({
    name:  typeof opt === 'string' ? opt : opt.label,
    value: i,
  }));
  const { idx } = await inquirer.prompt([{
    type:    'list',
    name:    'idx',
    message: chalk.bold.white(label),
    prefix:  chalk.cyan('▶'),
    choices,
    default: defaultIndex,
  }]);
  return idx;
}

// ── confirm ───────────────────────────────────────────────────────────────────

async function confirm(question) {
  const { answer } = await inquirer.prompt([{
    type:    'confirm',
    name:    'answer',
    message: chalk.bold.white(question),
    prefix:  chalk.cyan('▶'),
    default: false,
  }]);
  return answer;
}

// ── withSpinner ───────────────────────────────────────────────────────────────

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

function renderWaveform(samples, width) {
  const n = BLOCKS.length;
  let result = '';
  for (let col = 0; col < width; col++) {
    const sampleIdx = Math.min(
      samples.length - 1,
      Math.floor((col / width) * samples.length)
    );
    const amp = Math.max(-1, Math.min(1, samples[sampleIdx]));
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

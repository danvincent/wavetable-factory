'use strict';

const readline = require('readline');
const chalk = require('chalk');

// ── Readline singleton ────────────────────────────────────────────────────────

let _rl = null;

function getRL() {
  if (!_rl) {
    _rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    });
  }
  return _rl;
}

/** Close and reset the readline interface (call on exit). */
function closeRL() {
  if (_rl) { _rl.close(); _rl = null; }
}

// ── Low-level ask ─────────────────────────────────────────────────────────────

/**
 * Ask a question and resolve with the trimmed answer.
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(question) {
  return new Promise(resolve => {
    getRL().question(chalk.cyan('▶ ') + chalk.white(question) + ' ', answer => {
      resolve(answer.trim());
    });
  });
}

// ── choose ────────────────────────────────────────────────────────────────────

/**
 * Print a numbered list of options and resolve with the selected one.
 * Re-prompts on invalid input.
 * @param {string} label
 * @param {Array<{ value: string, label: string }>} options
 * @returns {Promise<{ value: string, label: string }>}
 */
async function choose(label, options) {
  console.log('');
  console.log(chalk.bold.white(label));
  options.forEach((opt, i) => {
    console.log(`  ${chalk.yellow(String(i + 1))}  ${opt.label}`);
  });
  console.log('');

  while (true) {
    const raw = await ask('Enter number:');
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= options.length) {
      return options[n - 1];
    }
    printError(`Please enter a number between 1 and ${options.length}`);
  }
}

// ── confirm ───────────────────────────────────────────────────────────────────

/**
 * Ask a yes/no question. Defaults to No on empty input.
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function confirm(question) {
  while (true) {
    const raw = await ask(`${question} ${chalk.grey('[y/N]')}`);
    if (raw === '' || raw.toLowerCase() === 'n') return false;
    if (raw.toLowerCase() === 'y') return true;
    printError('Please enter y or n');
  }
}

// ── Print helpers ─────────────────────────────────────────────────────────────

const BOX_W = 50;

/** Print a framed section header. */
function printHeader(title) {
  const inner = ` ${title} `;
  const pad   = Math.max(0, BOX_W - inner.length - 2);
  const left  = Math.floor(pad / 2);
  const right = pad - left;
  const line  = '─'.repeat(BOX_W);
  console.log('');
  console.log(chalk.cyan('┌' + line + '┐'));
  console.log(chalk.cyan('│') + ' '.repeat(left) + chalk.bold.white(inner) + ' '.repeat(right) + chalk.cyan('│'));
  console.log(chalk.cyan('└' + line + '┘'));
  console.log('');
}

/** Print the application banner. */
function printBanner() {
  const title = '  ♪  WAVETABLE FACTORY  ';
  const pad   = Math.max(0, BOX_W - title.length);
  const line  = '═'.repeat(BOX_W + 2);
  console.log('');
  console.log(chalk.blueBright('╔' + line + '╗'));
  console.log(chalk.blueBright('║') + chalk.bold.white(title) + ' '.repeat(pad) + ' ' + chalk.blueBright('║'));
  console.log(chalk.blueBright('╚' + line + '╝'));
  console.log('');
}

/** Print a success message. */
function printSuccess(msg) {
  console.log(chalk.green('✔ ') + chalk.greenBright(msg));
}

/** Print an error message. */
function printError(msg) {
  console.log(chalk.red('✖ ') + chalk.redBright(msg));
}

/** Print an informational message. */
function printInfo(msg) {
  console.log(chalk.grey('  ' + msg));
}

/** Print a horizontal rule. */
function hr() {
  console.log(chalk.grey('─'.repeat(BOX_W + 2)));
}

module.exports = { ask, choose, confirm, printHeader, printBanner, printSuccess, printError, printInfo, hr, closeRL };

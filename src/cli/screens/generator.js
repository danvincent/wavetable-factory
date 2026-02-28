'use strict';

const path = require('path');
const fs   = require('fs-extra');

const { ask, choose, printHeader, printSuccess, printError, printInfo, hr } = require('../prompt');
const { generateWavetable } = require('../../engine/generator');
const { generateRandomWavetable } = require('../../engine/randomizer');
const { exportForAbleton, exportForPolyend } = require('../../engine/exporter');
const {
  WAVEFORM_TYPES, ABLETON, POLYEND, SUBFOLDER_NAMES,
  COMPLEXITY_MIN, COMPLEXITY_MAX, COMPLEXITY_DEFAULT,
} = require('../../constants');

// ── Random name generation ────────────────────────────────────────────────────

const ADJECTIVES = [
  'amber','azure','bold','bright','calm','cold','dark','deep','dense','dry',
  'dull','fast','flat','fluid','frosty','fuzzy','glassy','golden','gritty',
  'harsh','hollow','icy','lush','mellow','misty','murky','nasal','noisy',
  'open','pale','pure','raw','rich','rough','sharp','silky','smooth','soft',
  'solar','sonic','spectral','still','strange','sweet','thick','thin','warm',
];

const NOUNS = [
  'arc','bell','blade','bolt','breeze','chord','cloud','coil','comb','core',
  'crystal','curve','dawn','dusk','echo','field','flame','flow','fog','forge',
  'ghost','grain','haze','ion','jet','knot','lake','lens','loop','mesa',
  'moon','node','orbit','peak','phase','plain','plume','pole','prism','pulse',
  'ring','sand','shell','shift','slope','spark','sphere','spiral','star','stream',
  'tide','tone','trace','vault','veil','void','wave','wing','wood','zone',
];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateName(type) {
  return `${randomFrom(ADJECTIVES)}-${randomFrom(NOUNS)}-${type}`;
}

// ── Target selection ──────────────────────────────────────────────────────────

const TARGET_OPTIONS = ['Ableton Live (32-bit float)', 'Polyend Tracker (16-bit PCM)', 'Both'];

async function pickTarget() {
  return choose('Export target', TARGET_OPTIONS);
}

// ── Save helpers ──────────────────────────────────────────────────────────────

async function saveWavetable(frames, name, target, libraryPath) {
  const abletonDir  = path.join(libraryPath, SUBFOLDER_NAMES.ABLETON);
  const polyendDir  = path.join(libraryPath, SUBFOLDER_NAMES.POLYEND);
  const saved = [];

  if (target === 0 || target === 2) { // Ableton or Both
    await fs.ensureDir(abletonDir);
    const out = path.join(abletonDir, `${name}.wav`);
    await exportForAbleton(frames, out);
    saved.push(out);
  }
  if (target === 1 || target === 2) { // Polyend or Both
    await fs.ensureDir(polyendDir);
    const out = path.join(polyendDir, `${name}.wav`);
    await exportForPolyend(frames, out);
    saved.push(out);
  }
  return saved;
}

// ── Sub-menu ──────────────────────────────────────────────────────────────────

async function generatorMenu(config) {
  while (true) {
    printHeader('Wavetable Generator');
    printInfo('Select a waveform type or generate a random wavetable.\n');

    const waveformLabels = WAVEFORM_TYPES.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    const menuOptions = [...waveformLabels, 'Random (fully randomised)'];

    const sel = await ask('  Choose [1-' + (menuOptions.length) + '] or 0 to go back');
    if (sel === '0') break;

    const idx = parseInt(sel, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= menuOptions.length) {
      printError('Invalid selection.');
      continue;
    }

    const isRandom = idx === menuOptions.length - 1;
    const type = isRandom ? 'random' : WAVEFORM_TYPES[idx];

    hr();

    let complexity = COMPLEXITY_DEFAULT;
    let frameCount = ABLETON.defaultFrameCount;

    if (!isRandom) {
      const complexStr = await ask(
        `Complexity (${COMPLEXITY_MIN}-${COMPLEXITY_MAX}) [${COMPLEXITY_DEFAULT}]`
      );
      if (complexStr !== '') {
        const c = parseInt(complexStr, 10);
        if (!isNaN(c) && c >= COMPLEXITY_MIN && c <= COMPLEXITY_MAX) complexity = c;
        else { printError('Invalid complexity — using default.'); }
      }

      const frameStr = await ask(`Frame count [${ABLETON.defaultFrameCount}]`);
      if (frameStr !== '') {
        const f = parseInt(frameStr, 10);
        if (!isNaN(f) && f >= 1 && f <= ABLETON.maxFrameCount) frameCount = f;
        else { printError('Invalid frame count — using default.'); }
      }
    }

    const targetIdx = await pickTarget();
    const libraryPath = config.getLibraryPath();
    if (!libraryPath) {
      printError('Library path not configured. Please set it in Settings.');
      continue;
    }

    try {
      printInfo('\nGenerating…');
      let frames;
      if (isRandom) {
        frames = generateRandomWavetable(complexity, frameCount, ABLETON.samplesPerFrame);
        type; // type is 'random' — use for name
      } else {
        frames = generateWavetable({ type, frameCount, samplesPerFrame: ABLETON.samplesPerFrame, complexity });
      }

      const name = generateName(isRandom ? 'random' : type);
      const saved = await saveWavetable(frames, name, targetIdx, libraryPath);
      saved.forEach(p => printSuccess(`Saved: ${p}`));
    } catch (err) {
      printError(`Failed: ${err.message}`);
    }

    hr();
    await ask('Press Enter to continue');
  }
}

module.exports = { generatorMenu, generateName, randomFrom };

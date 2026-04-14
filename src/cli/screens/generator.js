'use strict';

const path = require('path');
const fs   = require('fs-extra');

const { choose, askValidated, ask, printHeader, printSuccess, printError, printInfo, hr } = require('../prompt');
const { generateWavetable } = require('../../engine/generator');
const { generateRandomWavetable } = require('../../engine/randomizer');
const { exportForAbleton, exportForPolyend, exportForPirateSynthWt } = require('../../engine/exporter');
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

function generateName() {
  return `${randomFrom(ADJECTIVES)}-${randomFrom(NOUNS)}-table`;
}

// ── Save helpers ──────────────────────────────────────────────────────────────

async function saveWavetable(frames, name, target, libraryPath) {
  const abletonDir = path.join(libraryPath, SUBFOLDER_NAMES.ABLETON);
  const polyendDir = path.join(libraryPath, SUBFOLDER_NAMES.POLYEND);
  const pirateDir = path.join(libraryPath, SUBFOLDER_NAMES.PIRATE);
  const saved = [];

  if (target === TARGET.ABLETON || target === TARGET.BOTH || target === TARGET.ALL) {
    await fs.ensureDir(abletonDir);
    const out = path.join(abletonDir, `${name}.wav`);
    await exportForAbleton(frames, out);
    saved.push(out);
  }
  if (target === TARGET.POLYEND || target === TARGET.BOTH || target === TARGET.ALL) {
    await fs.ensureDir(polyendDir);
    const out = path.join(polyendDir, `${name}.wav`);
    await exportForPolyend(frames, out);
    saved.push(out);
  }
  if (target === TARGET.PIRATE || target === TARGET.ALL) {
    await fs.ensureDir(pirateDir);
    const out = path.join(pirateDir, `${name}.txt`);
    await exportForPirateSynthWt(frames, out);
    saved.push(out);
  }
  return saved;
}

// ── Sub-menu ──────────────────────────────────────────────────────────────────

const WAVEFORM_LABELS = WAVEFORM_TYPES.map(t => t.charAt(0).toUpperCase() + t.slice(1));
const GENERATOR_OPTIONS = [...WAVEFORM_LABELS, 'Random (fully randomised)', 'Back'];
const RANDOM_IDX = GENERATOR_OPTIONS.indexOf('Random (fully randomised)');
const BACK_IDX   = GENERATOR_OPTIONS.indexOf('Back');

const TARGET_OPTIONS = [
  'Ableton Live (32-bit float WAV)',
  'Polyend Tracker (16-bit PCM WAV)',
  'pirate-synth (text .txt)',
  'Both (Ableton + Polyend)',
  'All (Ableton + Polyend + pirate-synth .txt)',
];
const TARGET = {
  ABLETON: 0,
  POLYEND: 1,
  PIRATE: 2,
  BOTH: 3,
  ALL: 4,
};
const TARGET_DEFAULT  = TARGET.BOTH;

async function generatorMenu(config) {
  while (true) {
    printHeader('Wavetable Generator');

    const idx = await choose('Select waveform type', GENERATOR_OPTIONS, RANDOM_IDX);
    if (idx === BACK_IDX) break;

    const isRandom = idx === RANDOM_IDX;
    const type     = isRandom ? 'random' : WAVEFORM_TYPES[idx];

    hr();

    let complexity = COMPLEXITY_DEFAULT;
    let frameCount = ABLETON.defaultFrameCount;

    if (!isRandom) {
      const complexStr = await askValidated(
        `Complexity (${COMPLEXITY_MIN}–${COMPLEXITY_MAX})`,
        v => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n < COMPLEXITY_MIN || n > COMPLEXITY_MAX)
            return `Enter a number between ${COMPLEXITY_MIN} and ${COMPLEXITY_MAX}`;
          return null;
        },
        String(COMPLEXITY_DEFAULT)
      );
      complexity = parseInt(complexStr, 10);

      const frameStr = await askValidated(
        `Frame count (1–${ABLETON.maxFrameCount})`,
        v => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n < 1 || n > ABLETON.maxFrameCount)
            return `Enter a number between 1 and ${ABLETON.maxFrameCount}`;
          return null;
        },
        String(ABLETON.defaultFrameCount)
      );
      frameCount = parseInt(frameStr, 10);
    } else {
      const complexStr = await askValidated(
        `Complexity (${COMPLEXITY_MIN}–${COMPLEXITY_MAX})`,
        v => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n < COMPLEXITY_MIN || n > COMPLEXITY_MAX)
            return `Enter a number between ${COMPLEXITY_MIN} and ${COMPLEXITY_MAX}`;
          return null;
        },
        String(COMPLEXITY_DEFAULT)
      );
      complexity = parseInt(complexStr, 10);
    }

    const targetIdx = await choose('Export target', TARGET_OPTIONS, TARGET_DEFAULT);

    const libraryPath = config.getLibraryPath();
    if (!libraryPath) {
      printError('Library path not configured. Please set it in Settings.');
      continue;
    }

    try {
      printInfo('Generating…');
      const frames = isRandom
        ? generateRandomWavetable(complexity, frameCount, ABLETON.samplesPerFrame)
        : generateWavetable({ type, frameCount, samplesPerFrame: ABLETON.samplesPerFrame, complexity });

      const name  = generateName();
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

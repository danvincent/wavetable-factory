'use strict';

// Ableton Wavetable synth specification
const ABLETON = {
  samplesPerFrame: 2048,
  defaultFrameCount: 64,
  maxFrameCount: 256,
  sampleRate: 44100,
  bitDepth: 32,       // 32-bit float WAV
  channels: 1,
  format: 'float32',  // IEEE 754 float
};

// Polyend Tracker wavetable specification
const POLYEND = {
  samplesPerFrame: 256,
  defaultFrameCount: 1,
  maxFrameCount: 1,
  sampleRate: 44100,
  bitDepth: 16,       // 16-bit PCM WAV
  channels: 1,
  format: 'int16',
};

// pirate-synth text wavetable specification
const PIRATE_SYNTH = {
  extension: 'wt',
  format: 'text-float',
};

const DAW_SPECS = { ABLETON, POLYEND, PIRATE_SYNTH };

const SUBFOLDER_NAMES = {
  ABLETON: 'ableton',
  POLYEND: 'polyend',
  PIRATE: 'pirate',
};

const WAVEFORM_TYPES = ['sine', 'sawtooth', 'square', 'triangle', 'pulse', 'additive', 'noise', 'wavefold', 'fm', 'supersaw'];

const COMPLEXITY_MIN = 1;
const COMPLEXITY_MAX = 10;
const COMPLEXITY_DEFAULT = 5;

const CONFIG_DIR = '.config/wavetable-factory';
const CONFIG_FILE = 'settings.json';

const DEFAULT_SETTINGS = {
  libraryPath: null,
  defaultComplexity: COMPLEXITY_DEFAULT,
  defaultFrameCount: ABLETON.defaultFrameCount,
};

module.exports = {
  ABLETON,
  POLYEND,
  PIRATE_SYNTH,
  DAW_SPECS,
  SUBFOLDER_NAMES,
  WAVEFORM_TYPES,
  COMPLEXITY_MIN,
  COMPLEXITY_MAX,
  COMPLEXITY_DEFAULT,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_SETTINGS,
};

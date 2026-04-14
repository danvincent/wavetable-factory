'use strict';

const fs = require('fs-extra');
const { ABLETON, POLYEND } = require('../constants');

/**
 * Write a WAV file header into a Buffer at the given offset.
 * Supports audioFormat 1 (PCM) and 3 (IEEE float).
 *
 * WAV header layout (44 bytes):
 *  0-3   "RIFF"
 *  4-7   fileSize - 8
 *  8-11  "WAVE"
 * 12-15  "fmt "
 * 16-19  fmtChunkSize (16)
 * 20-21  audioFormat (1=PCM, 3=IEEE float)
 * 22-23  numChannels
 * 24-27  sampleRate
 * 28-31  byteRate
 * 32-33  blockAlign
 * 34-35  bitsPerSample
 * 36-39  "data"
 * 40-43  dataSize
 */
function writeWavHeader(buf, { numChannels, sampleRate, bitsPerSample, audioFormat, numSamples }) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);                // fmt chunk size
  buf.writeUInt16LE(audioFormat, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
}

/**
 * Concatenate all frames into a single Float32Array.
 * @param {Float32Array[]} frames
 * @returns {Float32Array}
 */
function flattenFrames(frames) {
  const total = frames.reduce((acc, f) => acc + f.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    out.set(frame, offset);
    offset += frame.length;
  }
  return out;
}

/**
 * Convert Float32Array samples ([-1, 1]) to Int16Array.
 * Clamps out-of-range values.
 * @param {Float32Array} samples
 * @returns {Int16Array}
 */
function convertTo16Bit(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    out[i] = clamped < 0
      ? Math.round(clamped * 32768)
      : Math.round(clamped * 32767);
  }
  return out;
}

/**
 * Export wavetable frames as a 32-bit float WAV file (Ableton format).
 * @param {Float32Array[]} frames
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
async function exportForAbleton(frames, outputPath) {
  const samples = flattenFrames(frames);
  const HEADER_SIZE = 44;
  const dataSize = samples.length * 4; // 4 bytes per float32
  const buf = Buffer.alloc(HEADER_SIZE + dataSize);

  writeWavHeader(buf, {
    numChannels: ABLETON.channels,
    sampleRate: ABLETON.sampleRate,
    bitsPerSample: ABLETON.bitDepth,
    audioFormat: 3, // IEEE float
    numSamples: samples.length,
  });

  // Write float32 samples little-endian after header
  for (let i = 0; i < samples.length; i++) {
    buf.writeFloatLE(samples[i], HEADER_SIZE + i * 4);
  }

  await fs.ensureDir(require('path').dirname(outputPath));
  await fs.writeFile(outputPath, buf);
}

/**
 * Export wavetable as a 16-bit PCM WAV file (Polyend Tracker format).
 * Always outputs exactly 256 samples (one single-cycle frame).
 * @param {Float32Array[]} frames
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
async function exportForPolyend(frames, outputPath) {
  // Polyend is single-cycle: use first frame only, truncated/padded to 256 samples
  const firstFrame = frames[0];
  const targetLength = POLYEND.samplesPerFrame;
  const float32 = firstFrame.length === targetLength
    ? firstFrame
    : (() => {
        const f = new Float32Array(targetLength);
        f.set(firstFrame.subarray(0, Math.min(firstFrame.length, targetLength)));
        return f;
      })();

  const int16 = convertTo16Bit(float32);
  const HEADER_SIZE = 44;
  const dataSize = int16.length * 2; // 2 bytes per int16
  const buf = Buffer.alloc(HEADER_SIZE + dataSize);

  writeWavHeader(buf, {
    numChannels: POLYEND.channels,
    sampleRate: POLYEND.sampleRate,
    bitsPerSample: POLYEND.bitDepth,
    audioFormat: 1, // PCM
    numSamples: int16.length,
  });

  for (let i = 0; i < int16.length; i++) {
    buf.writeInt16LE(int16[i], HEADER_SIZE + i * 2);
  }

  await fs.ensureDir(require('path').dirname(outputPath));
  await fs.writeFile(outputPath, buf);
}

/**
 * Export wavetable as pirate-synth text .txt format.
 * Format: one float sample per line in [-1, 1].
 * @param {Float32Array[]} frames
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
async function exportForPirateSynthWt(frames, outputPath) {
  const samples = flattenFrames(frames);
  const lines = [];
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    lines.push(clamped.toFixed(6));
  }
  const content = lines.join('\n') + '\n';

  await fs.ensureDir(require('path').dirname(outputPath));
  await fs.writeFile(outputPath, content, 'utf8');
}

module.exports = {
  writeWavHeader,
  flattenFrames,
  convertTo16Bit,
  exportForAbleton,
  exportForPolyend,
  exportForPirateSynthWt,
};

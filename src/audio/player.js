'use strict';

const fs = require('fs-extra');
const { spawn } = require('child_process');
const { ABLETON, POLYEND } = require('../constants');

// ── WAV reading ───────────────────────────────────────────────────────────────

/**
 * Parse a WAV buffer header and return audio parameters.
 * @param {Buffer} buf
 * @returns {{ audioFormat, numChannels, sampleRate, bitsPerSample, dataOffset, dataSize }}
 */
function parseWavHeader(buf) {
  return {
    audioFormat: buf.readUInt16LE(20),
    numChannels: buf.readUInt16LE(22),
    sampleRate: buf.readUInt32LE(24),
    bitsPerSample: buf.readUInt16LE(34),
    dataSize: buf.readUInt32LE(40),
    dataOffset: 44,
  };
}

/**
 * Read flat samples from WAV buffer starting at dataOffset.
 * Returns Float32Array normalised to [-1, 1].
 * @param {Buffer} buf
 * @param {{ audioFormat, bitsPerSample, dataOffset, dataSize }} header
 * @returns {Float32Array}
 */
function readSamples(buf, header) {
  const { audioFormat, bitsPerSample, dataOffset, dataSize } = header;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = dataSize / bytesPerSample;
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const offset = dataOffset + i * bytesPerSample;
    if (audioFormat === 3 && bitsPerSample === 32) {
      samples[i] = buf.readFloatLE(offset);
    } else if (audioFormat === 1 && bitsPerSample === 16) {
      const raw = buf.readInt16LE(offset);
      samples[i] = raw < 0 ? raw / 32768 : raw / 32767;
    }
  }
  return samples;
}

/**
 * Split flat sample array into frames based on samplesPerFrame.
 * @param {Float32Array} flat
 * @param {number} samplesPerFrame
 * @returns {Float32Array[]}
 */
function splitIntoFrames(flat, samplesPerFrame) {
  const numFrames = Math.max(1, Math.floor(flat.length / samplesPerFrame));
  return Array.from({ length: numFrames }, (_, i) =>
    flat.slice(i * samplesPerFrame, (i + 1) * samplesPerFrame)
  );
}

/**
 * Load a wavetable WAV file and return parsed frames.
 * Detects Ableton (32-bit float) and Polyend (16-bit PCM) formats automatically.
 *
 * @param {string} filePath
 * @returns {Promise<{ frames: Float32Array[], sampleRate: number, bitDepth: number }>}
 */
async function loadWavetable(filePath) {
  const buf = await fs.readFile(filePath);
  const header = parseWavHeader(buf);
  const flat = readSamples(buf, header);

  // Determine samplesPerFrame from bit depth
  const samplesPerFrame = header.bitsPerSample === 16
    ? POLYEND.samplesPerFrame
    : ABLETON.samplesPerFrame;

  const frames = splitIntoFrames(flat, samplesPerFrame);
  return {
    frames,
    sampleRate: header.sampleRate,
    bitDepth: header.bitsPerSample,
  };
}

// ── Window extraction ─────────────────────────────────────────────────────────

/**
 * Clamp position to [0, 1].
 * @param {number} value
 * @returns {number}
 */
function positionClamp(value) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Clamp window size to [1, totalFrames].
 * @param {number} value
 * @param {number} totalFrames
 * @returns {number}
 */
function windowSizeClamp(value, totalFrames) {
  return Math.max(1, Math.min(totalFrames, Math.round(value)));
}

/**
 * Extract a contiguous slice of frames as a flat sample buffer.
 * Position 0=first frame, 1=last possible start frame.
 *
 * @param {Float32Array[]} frames
 * @param {number} position - 0.0–1.0
 * @param {number} windowSize - number of frames
 * @returns {Float32Array}
 */
function getWindow(frames, position, windowSize) {
  const total = frames.length;
  const maxStart = Math.max(0, total - windowSize);
  const startFrame = Math.round(positionClamp(position) * maxStart);
  const endFrame = Math.min(total, startFrame + windowSize);

  const samplesPerFrame = frames[0] ? frames[0].length : 0;
  const out = new Float32Array((endFrame - startFrame) * samplesPerFrame);
  for (let f = startFrame; f < endFrame; f++) {
    out.set(frames[f], (f - startFrame) * samplesPerFrame);
  }
  return out;
}

// ── Playback (ffplay stdin pipe) ──────────────────────────────────────────────

let ffplayProcess = null;
let currentSamples = null;
let loopRunning = false;

/**
 * Convert Float32Array to Int16 Buffer for ffplay (s16le).
 * @param {Float32Array} samples
 * @returns {Buffer}
 */
function toInt16Buffer(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const val = clamped < 0
      ? Math.round(clamped * 32768)
      : Math.round(clamped * 32767);
    buf.writeInt16LE(val, i * 2);
  }
  return buf;
}

/**
 * Write one loop iteration to ffplay stdin, then schedule next.
 */
function writeLoop() {
  if (!loopRunning || !ffplayProcess || ffplayProcess.stdin.destroyed) {
    loopRunning = false;
    return;
  }
  const buf = toInt16Buffer(currentSamples);
  ffplayProcess.stdin.write(buf, () => {
    if (loopRunning) writeLoop();
  });
}

/**
 * Start gapless looped playback by piping raw 16-bit PCM to ffplay stdin.
 * @param {Float32Array} samples - initial sample window
 * @param {number} sampleRate
 */
function startPlayback(samples, sampleRate) {
  stopPlayback();
  currentSamples = samples;
  ffplayProcess = spawn('ffplay', [
    '-f', 's16le',
    '-ar', String(sampleRate),
    '-ac', '1',
    '-nodisp',
    '-i', 'pipe:0',
  ], { stdio: ['pipe', 'ignore', 'ignore'] });

  ffplayProcess.on('error', () => { loopRunning = false; });
  loopRunning = true;
  writeLoop();
}

/**
 * Update the sample buffer being looped without restarting ffplay.
 * @param {Float32Array} samples
 */
function updatePlaybackWindow(samples) {
  currentSamples = samples;
}

/**
 * Stop playback and kill ffplay process.
 */
function stopPlayback() {
  loopRunning = false;
  if (ffplayProcess) {
    try {
      ffplayProcess.stdin.end();
      ffplayProcess.kill();
    } catch (_) { /* process may already be dead */ }
    ffplayProcess = null;
  }
}

module.exports = {
  loadWavetable,
  getWindow,
  positionClamp,
  windowSizeClamp,
  startPlayback,
  stopPlayback,
  updatePlaybackWindow,
};

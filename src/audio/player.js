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

// ── Phase-accumulator synthesis ───────────────────────────────────────────────

/**
 * Synthesize audio from wavetable frames at a target musical pitch.
 *
 * A wavetable frame represents ONE cycle of a waveform. The synth reads through
 * the frame using a phase accumulator that advances by (freq / sampleRate) per
 * output sample, wrapping at 1.0 — this plays the waveform at the correct pitch
 * regardless of how many samples are in the frame.
 *
 * When windowSize > 1, the synth slowly morphs through consecutive frames,
 * completing one pass through the window over `durationSec` seconds.
 *
 * @param {Float32Array[]} frames      - All wavetable frames
 * @param {number}         position    - 0.0–1.0, which frame to start at
 * @param {number}         windowSize  - How many frames to scan through
 * @param {number}         freq        - Target frequency in Hz (e.g. 261.63 for middle C)
 * @param {number}         sampleRate  - Output sample rate (e.g. 44100)
 * @param {number}         durationSec - Output duration in seconds
 * @returns {Float32Array}
 */
function synthesize(frames, position, windowSize, freq, sampleRate, durationSec) {
  const totalFrames = frames.length;
  const maxStart = Math.max(0, totalFrames - windowSize);
  const startFrame = Math.round(positionClamp(position) * maxStart);
  const endFrame = Math.min(totalFrames, startFrame + windowSizeClamp(windowSize, totalFrames));
  const frameSlice = frames.slice(startFrame, endFrame);

  const numOutputSamples = Math.round(sampleRate * durationSec);
  const output = new Float32Array(numOutputSamples);
  const phaseIncrement = freq / sampleRate;
  let phase = 0;

  for (let i = 0; i < numOutputSamples; i++) {
    // Slowly morph through frame window over the full duration
    const windowPhase = frameSlice.length <= 1 ? 0 : i / (numOutputSamples - 1);
    const frameIdx = Math.min(frameSlice.length - 1, Math.floor(windowPhase * frameSlice.length));
    const frame = frameSlice[frameIdx];
    const samplesPerFrame = frame.length;

    // Linear interpolation between adjacent samples for smooth reads
    const rawIdx = phase * samplesPerFrame;
    const idx0 = Math.floor(rawIdx) % samplesPerFrame;
    const idx1 = (idx0 + 1) % samplesPerFrame;
    const frac = rawIdx - Math.floor(rawIdx);
    output[i] = frame[idx0] * (1 - frac) + frame[idx1] * frac;

    phase += phaseIncrement;
    if (phase >= 1) phase -= Math.floor(phase);
  }

  return output;
}


const os = require('os');
const path = require('path');

let ffplayProcess = null;
const TEMP_WAV = path.join(os.tmpdir(), 'wavetable-factory-preview.wav');
const PREVIEW_DURATION_SEC = 10;

/**
 * Convert Float32Array to Int16 Buffer.
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
 * Write synthesized samples to a temporary WAV file and play it with ffplay.
 * Uses -loop 0 so ffplay loops the file indefinitely until killed.
 * This avoids any stdin-pipe tight-loop CPU issue.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 */
function startPlayback(samples, sampleRate) {
  stopPlayback();

  // Write 16-bit PCM WAV to temp file
  const pcm = toInt16Buffer(samples);
  const HEADER_SIZE = 44;
  const wavBuf = Buffer.alloc(HEADER_SIZE + pcm.length);

  const dataSize  = pcm.length;
  const fileSize  = 36 + dataSize;
  const byteRate  = sampleRate * 2; // 1 channel, 16-bit
  wavBuf.write('RIFF', 0, 'ascii');
  wavBuf.writeUInt32LE(fileSize, 4);
  wavBuf.write('WAVE', 8, 'ascii');
  wavBuf.write('fmt ', 12, 'ascii');
  wavBuf.writeUInt32LE(16, 16);
  wavBuf.writeUInt16LE(1, 20);              // PCM
  wavBuf.writeUInt16LE(1, 22);              // mono
  wavBuf.writeUInt32LE(sampleRate, 24);
  wavBuf.writeUInt32LE(byteRate, 28);
  wavBuf.writeUInt16LE(2, 32);              // block align
  wavBuf.writeUInt16LE(16, 34);             // bits per sample
  wavBuf.write('data', 36, 'ascii');
  wavBuf.writeUInt32LE(dataSize, 40);
  pcm.copy(wavBuf, HEADER_SIZE);

  fs.writeFileSync(TEMP_WAV, wavBuf);

  ffplayProcess = spawn('ffplay', [
    '-nodisp',
    '-autoexit',
    '-loop', '0',
    TEMP_WAV,
  ], { stdio: 'ignore' });

  ffplayProcess.on('error', () => { ffplayProcess = null; });
}

/**
 * Re-generate the temp WAV with updated samples and restart ffplay.
 * Call this when position/window changes during playback.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 */
function updatePlaybackWindow(samples, sampleRate) {
  if (ffplayProcess) {
    startPlayback(samples, sampleRate);
  }
}

/**
 * Stop playback and kill ffplay process.
 */
function stopPlayback() {
  if (ffplayProcess) {
    try { ffplayProcess.kill(); } catch (_) { /* already dead */ }
    ffplayProcess = null;
  }
}

module.exports = {
  loadWavetable,
  synthesize,
  getWindow,
  positionClamp,
  windowSizeClamp,
  startPlayback,
  stopPlayback,
  updatePlaybackWindow,
};

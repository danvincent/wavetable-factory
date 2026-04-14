'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const {
  exportForAbleton,
  exportForPolyend,
  exportForPirateSynthWt,
  convertTo16Bit,
  flattenFrames,
} = require('../../src/engine/exporter');

const TMP_DIR = path.join(os.tmpdir(), 'wf-exporter-test-' + process.pid);

// Build a minimal set of frames for testing
function makeFrames(frameCount, samplesPerFrame, value = 0.5) {
  return Array.from({ length: frameCount }, () => {
    const frame = new Float32Array(samplesPerFrame);
    frame.fill(value);
    return frame;
  });
}

// Parse a raw WAV buffer's header fields
function parseWavHeader(buf) {
  return {
    riff: buf.toString('ascii', 0, 4),
    wave: buf.toString('ascii', 8, 12),
    fmt: buf.toString('ascii', 12, 16),
    audioFormat: buf.readUInt16LE(20),
    numChannels: buf.readUInt16LE(22),
    sampleRate: buf.readUInt32LE(24),
    bitsPerSample: buf.readUInt16LE(34),
    data: buf.toString('ascii', 36, 40),
    dataSize: buf.readUInt32LE(40),
  };
}

beforeAll(() => fs.ensureDirSync(TMP_DIR));
afterAll(() => fs.removeSync(TMP_DIR));

describe('convertTo16Bit(float32Samples)', () => {
  test('converts 0.0 to 0', () => {
    const result = convertTo16Bit(new Float32Array([0]));
    expect(result[0]).toBe(0);
  });

  test('converts 1.0 to 32767', () => {
    const result = convertTo16Bit(new Float32Array([1.0]));
    expect(result[0]).toBe(32767);
  });

  test('converts -1.0 to -32768', () => {
    const result = convertTo16Bit(new Float32Array([-1.0]));
    expect(result[0]).toBe(-32768);
  });

  test('clamps values above 1.0', () => {
    const result = convertTo16Bit(new Float32Array([2.0]));
    expect(result[0]).toBe(32767);
  });

  test('clamps values below -1.0', () => {
    const result = convertTo16Bit(new Float32Array([-2.0]));
    expect(result[0]).toBe(-32768);
  });

  test('returns Int16Array of same length', () => {
    const input = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
    const result = convertTo16Bit(input);
    expect(result).toBeInstanceOf(Int16Array);
    expect(result.length).toBe(input.length);
  });
});

describe('flattenFrames(frames)', () => {
  test('concatenates all frames into one Float32Array', () => {
    const frames = makeFrames(4, 256);
    const flat = flattenFrames(frames);
    expect(flat).toBeInstanceOf(Float32Array);
    expect(flat.length).toBe(4 * 256);
  });

  test('sample order is preserved across frames', () => {
    const frameA = new Float32Array([0.1, 0.2]);
    const frameB = new Float32Array([0.3, 0.4]);
    const flat = flattenFrames([frameA, frameB]);
    expect(flat[0]).toBeCloseTo(0.1);
    expect(flat[1]).toBeCloseTo(0.2);
    expect(flat[2]).toBeCloseTo(0.3);
    expect(flat[3]).toBeCloseTo(0.4);
  });
});

describe('exportForAbleton(frames, outputPath)', () => {
  test('creates a WAV file on disk', async () => {
    const outPath = path.join(TMP_DIR, 'ableton-test.wav');
    const frames = makeFrames(4, 2048);
    await exportForAbleton(frames, outPath);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('WAV file has RIFF/WAVE header', async () => {
    const outPath = path.join(TMP_DIR, 'ableton-header.wav');
    await exportForAbleton(makeFrames(2, 2048), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.riff).toBe('RIFF');
    expect(header.wave).toBe('WAVE');
  });

  test('WAV file has 32-bit float format (audioFormat=3)', async () => {
    const outPath = path.join(TMP_DIR, 'ableton-format.wav');
    await exportForAbleton(makeFrames(2, 2048), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.audioFormat).toBe(3); // IEEE float
    expect(header.bitsPerSample).toBe(32);
  });

  test('WAV file has correct sample rate and channel count', async () => {
    const outPath = path.join(TMP_DIR, 'ableton-sr.wav');
    await exportForAbleton(makeFrames(2, 2048), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.sampleRate).toBe(44100);
    expect(header.numChannels).toBe(1);
  });

  test('data chunk size matches frame count * samples * 4 bytes', async () => {
    const frameCount = 4;
    const samplesPerFrame = 2048;
    const outPath = path.join(TMP_DIR, 'ableton-datasize.wav');
    await exportForAbleton(makeFrames(frameCount, samplesPerFrame), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.dataSize).toBe(frameCount * samplesPerFrame * 4);
  });
});

describe('exportForPolyend(frames, outputPath)', () => {
  test('creates a WAV file on disk', async () => {
    const outPath = path.join(TMP_DIR, 'polyend-test.wav');
    await exportForPolyend(makeFrames(1, 256), outPath);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('WAV file has 16-bit PCM format (audioFormat=1)', async () => {
    const outPath = path.join(TMP_DIR, 'polyend-format.wav');
    await exportForPolyend(makeFrames(1, 256), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.audioFormat).toBe(1); // PCM
    expect(header.bitsPerSample).toBe(16);
  });

  test('WAV file has correct sample rate', async () => {
    const outPath = path.join(TMP_DIR, 'polyend-sr.wav');
    await exportForPolyend(makeFrames(1, 256), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.sampleRate).toBe(44100);
  });

  test('data chunk size matches samples * 2 bytes (16-bit)', async () => {
    const outPath = path.join(TMP_DIR, 'polyend-datasize.wav');
    await exportForPolyend(makeFrames(1, 256), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.dataSize).toBe(256 * 2);
  });

  test('multi-frame input uses only first 256 samples', async () => {
    // Polyend is always single-cycle 256 samples
    const outPath = path.join(TMP_DIR, 'polyend-singlecycle.wav');
    await exportForPolyend(makeFrames(4, 256), outPath);
    const buf = fs.readFileSync(outPath);
    const header = parseWavHeader(buf);
    expect(header.dataSize).toBe(256 * 2);
  });
});

describe('exportForPirateSynthWt(frames, outputPath)', () => {
  test('creates a .wt text file on disk', async () => {
    const outPath = path.join(TMP_DIR, 'pirate-test.wt');
    await exportForPirateSynthWt(makeFrames(2, 8, 0.25), outPath);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('writes one numeric sample per line', async () => {
    const outPath = path.join(TMP_DIR, 'pirate-lines.wt');
    await exportForPirateSynthWt(makeFrames(2, 8, 0.25), outPath);
    const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(16);
    expect(lines[0]).toMatch(/^-?\d+\.\d+$/);
  });

  test('clamps out-of-range values to [-1, 1]', async () => {
    const outPath = path.join(TMP_DIR, 'pirate-clamp.wt');
    await exportForPirateSynthWt([new Float32Array([2, -2, 0.5])], outPath);
    const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n');
    expect(lines).toEqual(['1.000000', '-1.000000', '0.500000']);
  });
});

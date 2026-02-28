'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { scanLibrary, buildFileTree } = require('../../src/library/scanner');

const TMP_DIR = path.join(os.tmpdir(), 'wf-scanner-test-' + process.pid);

beforeEach(() => {
  fs.removeSync(TMP_DIR);
  fs.ensureDirSync(TMP_DIR);
});
afterAll(() => fs.removeSync(TMP_DIR));

function touch(relPath) {
  const full = path.join(TMP_DIR, relPath);
  fs.ensureDirSync(path.dirname(full));
  fs.writeFileSync(full, '');
}

describe('scanLibrary(libraryPath)', () => {
  test('returns empty array for empty directory', async () => {
    const files = await scanLibrary(TMP_DIR);
    expect(files).toEqual([]);
  });

  test('returns empty array for non-existent directory', async () => {
    const files = await scanLibrary(path.join(TMP_DIR, 'does-not-exist'));
    expect(files).toEqual([]);
  });

  test('returns .wav files at root level', async () => {
    touch('sine.wav');
    touch('saw.wav');
    const files = await scanLibrary(TMP_DIR);
    expect(files).toHaveLength(2);
  });

  test('returns .wav files recursively in subdirectories', async () => {
    touch('ableton/wave1.wav');
    touch('polyend/wave2.wav');
    touch('ableton/sub/wave3.wav');
    const files = await scanLibrary(TMP_DIR);
    expect(files).toHaveLength(3);
  });

  test('ignores non-.wav files', async () => {
    touch('sine.wav');
    touch('readme.txt');
    touch('patch.aif');
    const files = await scanLibrary(TMP_DIR);
    expect(files).toHaveLength(1);
  });

  test('each entry has name, path, and relativePath', async () => {
    touch('ableton/wave.wav');
    const files = await scanLibrary(TMP_DIR);
    expect(files[0]).toHaveProperty('name');
    expect(files[0]).toHaveProperty('path');
    expect(files[0]).toHaveProperty('relativePath');
  });

  test('relativePath is relative to the library root', async () => {
    touch('ableton/wave.wav');
    const files = await scanLibrary(TMP_DIR);
    expect(files[0].relativePath).toBe(path.join('ableton', 'wave.wav'));
  });

  test('name is just the filename without directory', async () => {
    touch('ableton/my-wave.wav');
    const files = await scanLibrary(TMP_DIR);
    expect(files[0].name).toBe('my-wave.wav');
  });
});

describe('buildFileTree(files)', () => {
  test('returns object with ableton and polyend keys', () => {
    const tree = buildFileTree([]);
    expect(tree).toHaveProperty('ableton');
    expect(tree).toHaveProperty('polyend');
    expect(tree).toHaveProperty('other');
  });

  test('groups files under ableton/ into ableton key', () => {
    const files = [
      { name: 'wave.wav', path: '/lib/ableton/wave.wav', relativePath: 'ableton/wave.wav' },
    ];
    const tree = buildFileTree(files);
    expect(tree.ableton).toHaveLength(1);
    expect(tree.polyend).toHaveLength(0);
  });

  test('groups files under polyend/ into polyend key', () => {
    const files = [
      { name: 'wave.wav', path: '/lib/polyend/wave.wav', relativePath: 'polyend/wave.wav' },
    ];
    const tree = buildFileTree(files);
    expect(tree.polyend).toHaveLength(1);
    expect(tree.ableton).toHaveLength(0);
  });

  test('files not in ableton/ or polyend/ go into other', () => {
    const files = [
      { name: 'wave.wav', path: '/lib/misc/wave.wav', relativePath: 'misc/wave.wav' },
    ];
    const tree = buildFileTree(files);
    expect(tree.other).toHaveLength(1);
  });

  test('mixed files are correctly grouped', () => {
    const files = [
      { name: 'a.wav', relativePath: 'ableton/a.wav', path: '/lib/ableton/a.wav' },
      { name: 'b.wav', relativePath: 'polyend/b.wav', path: '/lib/polyend/b.wav' },
      { name: 'c.wav', relativePath: 'ableton/sub/c.wav', path: '/lib/ableton/sub/c.wav' },
    ];
    const tree = buildFileTree(files);
    expect(tree.ableton).toHaveLength(2);
    expect(tree.polyend).toHaveLength(1);
    expect(tree.other).toHaveLength(0);
  });
});

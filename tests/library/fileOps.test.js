'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { renameFile, deleteFile, ensureSubfolders } = require('../../src/library/fileOps');

const TMP_DIR = path.join(os.tmpdir(), 'wf-fileops-test-' + process.pid);

beforeEach(() => {
  fs.removeSync(TMP_DIR);
  fs.ensureDirSync(TMP_DIR);
});
afterAll(() => fs.removeSync(TMP_DIR));

function touch(relPath, content = '') {
  const full = path.join(TMP_DIR, relPath);
  fs.ensureDirSync(path.dirname(full));
  fs.writeFileSync(full, content);
  return full;
}

describe('renameFile(oldPath, newPath)', () => {
  test('renames a file on disk', async () => {
    const src = touch('old.wav');
    const dest = path.join(TMP_DIR, 'new.wav');
    await renameFile(src, dest);
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.existsSync(src)).toBe(false);
  });

  test('preserves file content after rename', async () => {
    const src = touch('old.wav', 'hello');
    const dest = path.join(TMP_DIR, 'new.wav');
    await renameFile(src, dest);
    expect(fs.readFileSync(dest, 'utf8')).toBe('hello');
  });

  test('creates destination directory if it does not exist', async () => {
    const src = touch('wave.wav');
    const dest = path.join(TMP_DIR, 'subdir', 'renamed.wav');
    await renameFile(src, dest);
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('throws if source file does not exist', async () => {
    const src = path.join(TMP_DIR, 'nonexistent.wav');
    const dest = path.join(TMP_DIR, 'out.wav');
    await expect(renameFile(src, dest)).rejects.toThrow();
  });
});

describe('deleteFile(filePath)', () => {
  test('deletes a file and returns true', async () => {
    const file = touch('wave.wav');
    const result = await deleteFile(file);
    expect(result).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  test('returns false if file does not exist', async () => {
    const result = await deleteFile(path.join(TMP_DIR, 'ghost.wav'));
    expect(result).toBe(false);
  });

  test('does not throw if file does not exist', async () => {
    await expect(deleteFile(path.join(TMP_DIR, 'ghost.wav'))).resolves.toBe(false);
  });
});

describe('ensureSubfolders(libraryPath)', () => {
  test('creates ableton subfolder', async () => {
    await ensureSubfolders(TMP_DIR);
    expect(fs.existsSync(path.join(TMP_DIR, 'ableton'))).toBe(true);
  });

  test('creates polyend subfolder', async () => {
    await ensureSubfolders(TMP_DIR);
    expect(fs.existsSync(path.join(TMP_DIR, 'polyend'))).toBe(true);
  });

  test('does not throw if subfolders already exist', async () => {
    await ensureSubfolders(TMP_DIR);
    await expect(ensureSubfolders(TMP_DIR)).resolves.not.toThrow();
  });

  test('creates txt subfolder', async () => {
    await ensureSubfolders(TMP_DIR);
    expect(fs.existsSync(path.join(TMP_DIR, 'txt'))).toBe(true);
  });

  test('creates library root if it does not exist', async () => {
    const newLib = path.join(TMP_DIR, 'brand-new-library');
    await ensureSubfolders(newLib);
    expect(fs.existsSync(path.join(newLib, 'ableton'))).toBe(true);
    expect(fs.existsSync(path.join(newLib, 'polyend'))).toBe(true);
    expect(fs.existsSync(path.join(newLib, 'txt'))).toBe(true);
  });
});

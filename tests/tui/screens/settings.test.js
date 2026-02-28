'use strict';

jest.mock('blessed', () => {
  const widget = (opts = {}) => ({
    append: jest.fn(), hide: jest.fn(), show: jest.fn(), focus: jest.fn(),
    key: jest.fn(), on: jest.fn(), setContent: jest.fn(), setLabel: jest.fn(),
    render: jest.fn(), destroy: jest.fn(), screen: null,
    getValue: jest.fn(() => opts._defaultValue || ''),
    setValue: jest.fn(),
    content: opts.content || '',
  });
  return {
    screen: jest.fn(widget), box: jest.fn(widget), list: jest.fn(widget),
    text: jest.fn(widget), button: jest.fn(widget), textbox: jest.fn(widget),
    form: jest.fn(widget),
  };
});

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

// ── mock config ───────────────────────────────────────────────────────────────
const mockConfig = {
  load: jest.fn(() => ({ libraryPath: '/some/lib' })),
  save: jest.fn(),
  setLibraryPath: jest.fn(),
  getLibraryPath: jest.fn(() => '/some/lib'),
};

const { onSavePath, createSettingsScreen } = require('../../../src/tui/screens/settings');

beforeEach(() => jest.clearAllMocks());

// ── onSavePath ────────────────────────────────────────────────────────────────

describe('onSavePath(newPath, config)', () => {
  let tmpDir;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), 'wf-settings-test-' + process.pid);
    await fs.ensureDir(tmpDir);
  });

  afterAll(async () => {
    await fs.remove(tmpDir);
  });

  test('calls config.setLibraryPath with trimmed path when directory exists', async () => {
    const result = await onSavePath(`  ${tmpDir}  `, mockConfig);
    expect(mockConfig.setLibraryPath).toHaveBeenCalledWith(tmpDir);
    expect(result.success).toBe(true);
  });

  test('returns success message containing the path', async () => {
    const result = await onSavePath(tmpDir, mockConfig);
    expect(result.message).toContain(tmpDir);
  });

  test('returns error when path does not exist', async () => {
    const result = await onSavePath('/nonexistent/path/xyz', mockConfig);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/does not exist|not found/i);
  });

  test('does NOT call setLibraryPath when path does not exist', async () => {
    await onSavePath('/nonexistent/path/xyz', mockConfig);
    expect(mockConfig.setLibraryPath).not.toHaveBeenCalled();
  });

  test('returns error when path is empty string', async () => {
    const result = await onSavePath('', mockConfig);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/empty|required/i);
  });

  test('returns error when path is only whitespace', async () => {
    const result = await onSavePath('   ', mockConfig);
    expect(result.success).toBe(false);
  });

  test('returns error when path points to a file, not a directory', async () => {
    const filePath = path.join(tmpDir, 'notadir.txt');
    await fs.writeFile(filePath, 'hello');
    const result = await onSavePath(filePath, mockConfig);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/directory|folder/i);
  });
});

// ── createSettingsScreen ──────────────────────────────────────────────────────

describe('createSettingsScreen(panel, config)', () => {
  let panel;

  beforeEach(() => {
    const blessed = require('blessed');
    panel = blessed.box();
  });

  test('returns a container object', () => {
    const result = createSettingsScreen(panel, mockConfig);
    expect(result.container).toBeDefined();
  });

  test('appends container to panel', () => {
    createSettingsScreen(panel, mockConfig);
    expect(panel.append).toHaveBeenCalled();
  });

  test('returns a save function', () => {
    const result = createSettingsScreen(panel, mockConfig);
    expect(typeof result.save).toBe('function');
  });

  test('calling save with a valid path succeeds', async () => {
    const blessed = require('blessed');
    const fs = require('fs-extra');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), 'wf-settings-save-test-' + process.pid);
    await fs.ensureDir(tmp);
    const result = createSettingsScreen(panel, mockConfig);
    const outcome = await result.save(tmp);
    expect(outcome.success).toBe(true);
    await fs.remove(tmp);
  });

  test('calling save with invalid path returns error', async () => {
    const result = createSettingsScreen(panel, mockConfig);
    const outcome = await result.save('/definitely/does/not/exist');
    expect(outcome.success).toBe(false);
  });
});

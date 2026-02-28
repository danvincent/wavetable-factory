'use strict';

jest.mock('blessed', () => {
  const widget = () => ({
    append: jest.fn(), prepend: jest.fn(), hide: jest.fn(), show: jest.fn(),
    focus: jest.fn(), key: jest.fn(), on: jest.fn(), setContent: jest.fn(),
    setLabel: jest.fn(), render: jest.fn(), destroy: jest.fn(),
    setValue: jest.fn(), getValue: jest.fn(() => ''), setItems: jest.fn(),
    select: jest.fn(), items: [], getItem: jest.fn(), removeItem: jest.fn(),
  });
  return {
    screen: jest.fn(widget), box: jest.fn(widget), list: jest.fn(widget),
    form: jest.fn(widget), textbox: jest.fn(widget), text: jest.fn(widget),
    button: jest.fn(widget),
  };
});

jest.mock('../../../src/library/scanner', () => ({
  scanLibrary: jest.fn(),
  buildFileTree: jest.fn(),
}));
jest.mock('../../../src/library/fileOps', () => ({
  renameFile: jest.fn(),
  deleteFile: jest.fn(),
}));

const { scanLibrary, buildFileTree } = require('../../../src/library/scanner');
const { renameFile, deleteFile } = require('../../../src/library/fileOps');

const {
  formatTreeItems,
  getFileAtIndex,
  loadTree,
  onRename,
  onDelete,
  onSendToPlayer,
} = require('../../../src/tui/screens/browser');

beforeEach(() => jest.clearAllMocks());

// ── formatTreeItems ──────────────────────────────────────────────────────────

describe('formatTreeItems(tree)', () => {
  const tree = {
    ableton: [
      { name: 'sine.wav', path: '/lib/ableton/sine.wav', relativePath: 'ableton/sine.wav' },
      { name: 'saw.wav', path: '/lib/ableton/saw.wav', relativePath: 'ableton/saw.wav' },
    ],
    polyend: [
      { name: 'tri.wav', path: '/lib/polyend/tri.wav', relativePath: 'polyend/tri.wav' },
    ],
    other: [],
  };

  test('returns items array and fileMap array of same length', () => {
    const { items, fileMap } = formatTreeItems(tree);
    expect(items.length).toBe(fileMap.length);
  });

  test('includes ABLETON header in items', () => {
    const { items } = formatTreeItems(tree);
    expect(items.some(i => i.toUpperCase().includes('ABLETON'))).toBe(true);
  });

  test('includes POLYEND header in items', () => {
    const { items } = formatTreeItems(tree);
    expect(items.some(i => i.toUpperCase().includes('POLYEND'))).toBe(true);
  });

  test('header entries have null in fileMap', () => {
    const { items, fileMap } = formatTreeItems(tree);
    const headerIndices = items.map((item, i) =>
      item.toUpperCase().includes('ABLETON') || item.toUpperCase().includes('POLYEND') ? i : -1
    ).filter(i => i !== -1);
    for (const idx of headerIndices) {
      expect(fileMap[idx]).toBeNull();
    }
  });

  test('file entries have file objects in fileMap', () => {
    const { fileMap } = formatTreeItems(tree);
    const fileEntries = fileMap.filter(f => f !== null);
    expect(fileEntries).toHaveLength(3);
    expect(fileEntries[0].name).toBe('sine.wav');
    expect(fileEntries[1].name).toBe('saw.wav');
    expect(fileEntries[2].name).toBe('tri.wav');
  });

  test('shows file count in ABLETON header', () => {
    const { items } = formatTreeItems(tree);
    const abletonHeader = items.find(i => i.toUpperCase().includes('ABLETON'));
    expect(abletonHeader).toMatch(/2/);
  });

  test('OTHER section omitted when other is empty', () => {
    const { items } = formatTreeItems({ ...tree, other: [] });
    expect(items.some(i => i.toUpperCase().includes('OTHER'))).toBe(false);
  });

  test('OTHER section shown when other has files', () => {
    const withOther = {
      ...tree,
      other: [{ name: 'misc.wav', path: '/lib/misc.wav', relativePath: 'misc.wav' }],
    };
    const { items } = formatTreeItems(withOther);
    expect(items.some(i => i.toUpperCase().includes('OTHER'))).toBe(true);
  });

  test('empty library returns just headers with zero counts', () => {
    const empty = { ableton: [], polyend: [], other: [] };
    const { items } = formatTreeItems(empty);
    expect(items.some(i => i.toUpperCase().includes('ABLETON'))).toBe(true);
    expect(items.some(i => i.toUpperCase().includes('POLYEND'))).toBe(true);
  });
});

// ── getFileAtIndex ────────────────────────────────────────────────────────────

describe('getFileAtIndex(fileMap, index)', () => {
  const fileMap = [
    null,
    { name: 'sine.wav', path: '/lib/ableton/sine.wav' },
    { name: 'saw.wav', path: '/lib/ableton/saw.wav' },
    null,
    { name: 'tri.wav', path: '/lib/polyend/tri.wav' },
  ];

  test('returns file object for file index', () => {
    expect(getFileAtIndex(fileMap, 1).name).toBe('sine.wav');
  });

  test('returns null for header index', () => {
    expect(getFileAtIndex(fileMap, 0)).toBeNull();
    expect(getFileAtIndex(fileMap, 3)).toBeNull();
  });

  test('returns null for out-of-bounds index', () => {
    expect(getFileAtIndex(fileMap, 99)).toBeNull();
    expect(getFileAtIndex(fileMap, -1)).toBeNull();
  });
});

// ── loadTree ─────────────────────────────────────────────────────────────────

describe('loadTree(libraryPath)', () => {
  test('calls scanLibrary with the library path', async () => {
    scanLibrary.mockResolvedValue([]);
    buildFileTree.mockReturnValue({ ableton: [], polyend: [], other: [] });
    await loadTree('/my/lib');
    expect(scanLibrary).toHaveBeenCalledWith('/my/lib');
  });

  test('calls buildFileTree with scanned files', async () => {
    const files = [{ name: 'a.wav', path: '/lib/ableton/a.wav', relativePath: 'ableton/a.wav' }];
    scanLibrary.mockResolvedValue(files);
    buildFileTree.mockReturnValue({ ableton: files, polyend: [], other: [] });
    await loadTree('/my/lib');
    expect(buildFileTree).toHaveBeenCalledWith(files);
  });

  test('returns tree and formatted items', async () => {
    scanLibrary.mockResolvedValue([]);
    buildFileTree.mockReturnValue({ ableton: [], polyend: [], other: [] });
    const result = await loadTree('/my/lib');
    expect(result).toHaveProperty('tree');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('fileMap');
  });
});

// ── onRename ─────────────────────────────────────────────────────────────────

describe('onRename(filePath, newName)', () => {
  test('calls renameFile with old path and new path', async () => {
    renameFile.mockResolvedValue();
    await onRename('/lib/ableton/old.wav', 'new.wav');
    expect(renameFile).toHaveBeenCalledWith(
      '/lib/ableton/old.wav',
      '/lib/ableton/new.wav'
    );
  });

  test('returns success true on successful rename', async () => {
    renameFile.mockResolvedValue();
    const result = await onRename('/lib/ableton/old.wav', 'new.wav');
    expect(result.success).toBe(true);
  });

  test('returns success false and error on failure', async () => {
    renameFile.mockRejectedValue(new Error('permission denied'));
    const result = await onRename('/lib/ableton/old.wav', 'new.wav');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission denied/i);
  });

  test('preserves directory when building new path', async () => {
    renameFile.mockResolvedValue();
    await onRename('/lib/polyend/sub/old.wav', 'renamed.wav');
    expect(renameFile).toHaveBeenCalledWith(
      '/lib/polyend/sub/old.wav',
      '/lib/polyend/sub/renamed.wav'
    );
  });

  test('rejects empty new name', async () => {
    const result = await onRename('/lib/ableton/old.wav', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  test('appends .wav extension if missing', async () => {
    renameFile.mockResolvedValue();
    await onRename('/lib/ableton/old.wav', 'newname');
    expect(renameFile).toHaveBeenCalledWith(
      '/lib/ableton/old.wav',
      '/lib/ableton/newname.wav'
    );
  });
});

// ── onDelete ─────────────────────────────────────────────────────────────────

describe('onDelete(filePath)', () => {
  test('calls deleteFile with the file path', async () => {
    deleteFile.mockResolvedValue(true);
    await onDelete('/lib/ableton/wave.wav');
    expect(deleteFile).toHaveBeenCalledWith('/lib/ableton/wave.wav');
  });

  test('returns success true when file is deleted', async () => {
    deleteFile.mockResolvedValue(true);
    const result = await onDelete('/lib/ableton/wave.wav');
    expect(result.success).toBe(true);
  });

  test('returns success false when file does not exist', async () => {
    deleteFile.mockResolvedValue(false);
    const result = await onDelete('/lib/ableton/ghost.wav');
    expect(result.success).toBe(false);
  });

  test('returns success false on error', async () => {
    deleteFile.mockRejectedValue(new Error('locked'));
    const result = await onDelete('/lib/ableton/wave.wav');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/locked/i);
  });
});

// ── onSendToPlayer ────────────────────────────────────────────────────────────

describe('onSendToPlayer(filePath, callback)', () => {
  test('invokes callback with the file path', () => {
    const cb = jest.fn();
    onSendToPlayer('/lib/ableton/sine.wav', cb);
    expect(cb).toHaveBeenCalledWith('/lib/ableton/sine.wav');
  });

  test('does not throw when callback is not provided', () => {
    expect(() => onSendToPlayer('/lib/ableton/sine.wav')).not.toThrow();
  });
});

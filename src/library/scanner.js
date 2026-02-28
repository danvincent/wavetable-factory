'use strict';

const path = require('path');
const fs = require('fs-extra');
const { SUBFOLDER_NAMES } = require('../constants');

/**
 * Recursively scan a directory for .wav files.
 * Returns empty array if directory doesn't exist.
 *
 * @param {string} libraryPath
 * @returns {Promise<Array<{name: string, path: string, relativePath: string}>>}
 */
async function scanLibrary(libraryPath) {
  if (!fs.existsSync(libraryPath)) return [];

  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav')) {
        results.push({
          name: entry.name,
          path: full,
          relativePath: path.relative(libraryPath, full),
        });
      }
    }
  }

  await walk(libraryPath);
  return results;
}

/**
 * Group a flat file list into ableton / polyend / other buckets.
 *
 * @param {Array<{name, path, relativePath}>} files
 * @returns {{ ableton: Array, polyend: Array, other: Array }}
 */
function buildFileTree(files) {
  const tree = { ableton: [], polyend: [], other: [] };

  for (const file of files) {
    const parts = file.relativePath.split(path.sep);
    const topFolder = parts[0].toLowerCase();

    if (topFolder === SUBFOLDER_NAMES.ABLETON) {
      tree.ableton.push(file);
    } else if (topFolder === SUBFOLDER_NAMES.POLYEND) {
      tree.polyend.push(file);
    } else {
      tree.other.push(file);
    }
  }

  return tree;
}

module.exports = { scanLibrary, buildFileTree };

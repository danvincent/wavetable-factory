'use strict';

const path = require('path');
const fs = require('fs-extra');
const { SUBFOLDER_NAMES } = require('../constants');

/**
 * Rename a file. Creates destination directory if needed.
 * Throws if the source file does not exist.
 *
 * @param {string} oldPath
 * @param {string} newPath
 * @returns {Promise<void>}
 */
async function renameFile(oldPath, newPath) {
  if (!fs.existsSync(oldPath)) {
    throw new Error(`Source file not found: ${oldPath}`);
  }
  await fs.ensureDir(path.dirname(newPath));
  await fs.move(oldPath, newPath, { overwrite: false });
}

/**
 * Delete a file. Returns true on success, false if file doesn't exist.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function deleteFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  await fs.remove(filePath);
  return true;
}

/**
 * Ensure the library's ableton/ and polyend/ subfolders exist.
 * Creates the library root as well if absent.
 *
 * @param {string} libraryPath
 * @returns {Promise<void>}
 */
async function ensureSubfolders(libraryPath) {
  await fs.ensureDir(path.join(libraryPath, SUBFOLDER_NAMES.ABLETON));
  await fs.ensureDir(path.join(libraryPath, SUBFOLDER_NAMES.POLYEND));
}

module.exports = { renameFile, deleteFile, ensureSubfolders };

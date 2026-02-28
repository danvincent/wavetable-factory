'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { CONFIG_DIR, CONFIG_FILE, DEFAULT_SETTINGS } = require('./constants');

function getConfigPath() {
  return path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);
}

function load() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const data = fs.readJsonSync(configPath);
    return { ...DEFAULT_SETTINGS, ...data };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(partial) {
  const configPath = getConfigPath();
  fs.ensureDirSync(path.dirname(configPath));
  const current = load();
  const updated = { ...current, ...partial };
  fs.writeJsonSync(configPath, updated, { spaces: 2 });
  return updated;
}

function setLibraryPath(libraryPath) {
  return save({ libraryPath });
}

function getLibraryPath() {
  return load().libraryPath;
}

module.exports = { load, save, setLibraryPath, getLibraryPath };

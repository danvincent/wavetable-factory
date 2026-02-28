#!/usr/bin/env node
'use strict';

const config = require('../src/config');
const { mainMenu } = require('../src/cli/menu');
const { closeRL } = require('../src/cli/prompt');

mainMenu(config).then(() => closeRL()).catch(err => {
  console.error(err);
  closeRL();
  process.exit(1);
});

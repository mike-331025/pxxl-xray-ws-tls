// SPDX-License-Identifier: MIT
// One-time setup: download the pinned Xray-core release and stage it as
// `web-worker` alongside `server.js`. Safe to re-run; `server.js` only
// invokes it when `web-worker` is missing.
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const VERSION = 'v25.10.15';
const FILE = `Xray-linux-64.zip`;
const URL = `https://github.com/XTLS/Xray-core/releases/download/${VERSION}/${FILE}`;
const WORKDIR = __dirname;
const ZIP_PATH = path.join(WORKDIR, FILE);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
}

function ensureTool(tool) {
  const found = spawnSync('which', [tool], { stdio: 'pipe' });
  if (found.status !== 0) {
    throw new Error(`required tool missing: ${tool}`);
  }
}

ensureTool('curl');
ensureTool('unzip');

if (!fs.existsSync(ZIP_PATH)) {
  console.info(`[setup] downloading ${URL}`);
  run('curl', ['-fSL', '-o', ZIP_PATH, URL]);
}

console.info('[setup] unpacking Xray-core');
run('unzip', ['-o', ZIP_PATH, 'xray', 'geoip.dat', 'geosite.dat']);

fs.renameSync(path.join(WORKDIR, 'xray'), path.join(WORKDIR, 'web-worker'));
fs.chmodSync(path.join(WORKDIR, 'web-worker'), 0o755);

for (const name of ['geoip.dat', 'geosite.dat']) {
  if (!fs.existsSync(path.join(WORKDIR, name))) {
    throw new Error(`[setup] expected ${name} after unzip`);
  }
}

console.info('[setup] web-worker ready');

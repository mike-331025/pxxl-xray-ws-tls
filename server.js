// SPDX-License-Identifier: MIT
// Pxxl/conventional Node wrapper for Xray (VLESS + WS, plain inside).
// Pxxl Free terminates TLS at the edge; the container serves plain WS.
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const WORKDIR = __dirname;
const BIN = path.join(WORKDIR, 'web-worker');
const CONFIG_PATH = path.join(WORKDIR, 'config.json');

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const UUID = readEnv('UUID') || readEnv('APP_KEY') || '';
const WSPATH = readEnv('WSPATH') || readEnv('API_ROUTE') || '/api/v1/sync';
const PORT = Number(readEnv('PORT', '8080'));

if (!UUID) {
  console.error('[xray-wrapper] UUID is required (set UUID or APP_KEY).');
  process.exit(1);
}

if (!WSPATH.startsWith('/')) {
  console.error('[xray-wrapper] WSPATH must start with "/".');
  process.exit(1);
}

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error('[xray-wrapper] PORT must be a valid TCP port.');
  process.exit(1);
}

const config = {
  log: { loglevel: 'warning' },
  inbounds: [
    {
      port: PORT,
      listen: '0.0.0.0',
      protocol: 'vless',
      settings: {
        clients: [{ id: UUID, level: 0 }],
        decryption: 'none',
      },
      streamSettings: {
        network: 'ws',
        wsSettings: { path: WSPATH, headers: { Host: '' } },
      },
    },
  ],
  outbounds: [
    { protocol: 'freedom', tag: 'direct' },
    { protocol: 'blackhole', tag: 'block' },
  ],
};

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

if (!fs.existsSync(BIN)) {
  console.info('[xray-wrapper] web-worker missing; running setup.js');
  const setup = spawnSync(process.execPath, [path.join(WORKDIR, 'setup.js')], {
    stdio: 'inherit',
  });
  if (setup.status !== 0) {
    console.error('[xray-wrapper] setup.js failed');
    process.exit(setup.status ?? 1);
  }
}

const child = spawn(BIN, ['-c', CONFIG_PATH], { stdio: 'inherit' });

child.on('error', (err) => {
  console.error('[xray-wrapper] failed to start web-worker:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[xray-wrapper] web-worker terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

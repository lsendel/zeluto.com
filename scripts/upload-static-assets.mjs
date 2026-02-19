#!/usr/bin/env node
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function resolveGitSha() {
  if (process.env.GIT_SHA && process.env.GIT_SHA.trim().length > 0) {
    return process.env.GIT_SHA.trim();
  }
  return execSync('git rev-parse --short HEAD').toString().trim();
}

const bucket = process.env.STATIC_R2_BUCKET?.trim() || 'mauntic-static-assets';
const gitSha = resolveGitSha();
const stylesFile = path.resolve('dist/static/styles.css');

if (!existsSync(stylesFile)) {
  console.error(
    `[static-assets] Missing ${stylesFile}. Run "pnpm run static:build" before uploading.`,
  );
  process.exit(1);
}

const uploads = [
  { key: 'styles/latest.css', file: stylesFile },
  { key: `styles/${gitSha}.css`, file: stylesFile },
];

for (const upload of uploads) {
  console.log(`[static-assets] Uploading ${upload.file} -> ${bucket}/${upload.key}`);
  execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'r2', 'object', 'put', `${bucket}/${upload.key}`, '--file', upload.file],
    { stdio: 'inherit' },
  );
}

console.log('[static-assets] Upload complete');

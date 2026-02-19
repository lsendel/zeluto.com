#!/usr/bin/env node
import { spawn } from 'node:child_process';

const defaultFilters = [
  '@mauntic/gateway',
  '@mauntic/identity',
  '@mauntic/crm',
  '@mauntic/campaign',
  '@mauntic/analytics',
  '@mauntic/campaign-queue',
  '@mauntic/journey',
  '@mauntic/journey-queue',
  '@mauntic/analytics-queue',
];

const extraFilters = process.env.DEV_CORE_FILTERS
  ? process.env.DEV_CORE_FILTERS.split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  : [];

const filters = Array.from(new Set([...defaultFilters, ...extraFilters]));

const turboArgs = ['run', 'dev', '--parallel', '--no-cache'];

filters.forEach((filter) => {
  turboArgs.push('--filter', filter);
});

const passthroughArgs = process.argv.slice(2);
turboArgs.push(...passthroughArgs);

const child = spawn('turbo', turboArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

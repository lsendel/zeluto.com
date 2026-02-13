import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 15_000,
    setupFiles: ['./setup.ts'],
    // Run tests sequentially since they hit real services
    sequence: {
      concurrent: false,
    },
  },
});

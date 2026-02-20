import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['./setup.ts'],
  },
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['fsevents'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

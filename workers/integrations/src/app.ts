import { Hono } from 'hono';
import type { Env } from './index.js';

export function createApp() {
  const app = new Hono<Env>();

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', service: 'integrations' }));

  return app;
}

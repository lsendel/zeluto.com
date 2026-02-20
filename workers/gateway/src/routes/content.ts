import { Hono } from 'hono';
import type { Env } from '../index.js';
import { forwardToService } from '../lib/forward.js';

export function createContentRoutes() {
  const app = new Hono<Env>();

  app.all('/*', async (c) => {
    return forwardToService(c, c.env.CONTENT);
  });

  return app;
}

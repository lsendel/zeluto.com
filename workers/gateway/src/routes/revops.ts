import { Hono } from 'hono';
import type { Env } from '../index.js';
import { forwardToService } from '../lib/forward.js';

export function createRevopsRoutes() {
  const app = new Hono<Env>();

  // HTMX view partials
  app.all('/views/*', async (c) => {
    return forwardToService(c, c.env.REVOPS);
  });

  // All other routes
  app.all('/*', async (c) => {
    return forwardToService(c, c.env.REVOPS);
  });

  return app;
}

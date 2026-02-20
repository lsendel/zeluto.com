import { Hono } from 'hono';
import type { Env } from '../index.js';

export function createSeoRoutes() {
  const app = new Hono<Env>();

  app.get('/robots.txt', (c) => {
    const robotsTxt = `User-agent: *
Disallow: /api/
Disallow: /app/
Disallow: /onboarding/`;

    return c.text(robotsTxt);
  });

  return app;
}

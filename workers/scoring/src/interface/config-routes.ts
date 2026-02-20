import { Hono } from 'hono';
import type { Env } from '../app.js';

export const configRoutes = new Hono<Env>();

// GET /api/v1/scoring/scoring/config
configRoutes.get('/api/v1/scoring/scoring/config', async (c) => {
  // TODO: Wire up ScoringConfigRepository
  return c.json([]);
});

// PUT /api/v1/scoring/scoring/config
configRoutes.put('/api/v1/scoring/scoring/config', async (c) => {
  const _body = await c.req.json();

  // TODO: Wire up ScoringConfigRepository
  return c.json({ message: 'Configuration updated' });
});

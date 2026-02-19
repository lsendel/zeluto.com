import { Hono } from 'hono';
import type { Env } from '../app.js';

export const signalRoutes = new Hono<Env>();

// GET /api/v1/scoring/contacts/:contactId/signals
signalRoutes.get('/api/v1/scoring/contacts/:contactId/signals', async (c) => {
  const { contactId } = c.req.param();

  // TODO: Wire up IntentSignalRepository
  return c.json([]);
});

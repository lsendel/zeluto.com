import { Hono } from 'hono';
import type { Env } from '../app.js';

export const researchRoutes = new Hono<Env>();

researchRoutes.post('/api/v1/revops/research', async (c) => {
  const body = await c.req.json();
  const jobId = crypto.randomUUID();
  // TODO: Enqueue research job via EVENTS queue
  return c.json({ jobId, message: 'Research job queued' }, 202);
});

researchRoutes.get('/api/v1/revops/contacts/:contactId/insights', async (c) => {
  // TODO: Wire up ResearchRepository
  return c.json([]);
});

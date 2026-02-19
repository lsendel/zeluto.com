import { Hono } from 'hono';
import type { Env } from '../app.js';

export const sdrRoutes = new Hono<Env>();

sdrRoutes.get('/api/v1/revops/prospects', async (c) => {
  // TODO: Wire up ProspectRepository
  return c.json([]);
});

sdrRoutes.post('/api/v1/revops/prospects/:contactId/qualify', async (c) => {
  const { contactId } = c.req.param();
  // TODO: Wire up SDRAgent.qualify
  return c.json({ contactId, qualificationScore: 0, icpMatch: 0, recommendation: 'manual_review' });
});

sdrRoutes.get('/api/v1/revops/sequences', async (c) => {
  // TODO: Wire up SequenceRepository
  return c.json([]);
});

sdrRoutes.post('/api/v1/revops/sequences', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up SequenceRepository
  return c.json({ ...body, id: crypto.randomUUID(), status: 'draft', stepCount: 0 }, 201);
});

sdrRoutes.post('/api/v1/revops/sequences/:sequenceId/enroll', async (c) => {
  // TODO: Wire up SequenceRepository
  return c.json({ message: 'Enrolled' });
});

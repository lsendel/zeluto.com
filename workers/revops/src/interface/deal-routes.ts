import { Hono } from 'hono';
import type { Env } from '../app.js';

export const dealRoutes = new Hono<Env>();

dealRoutes.get('/api/v1/revops/deals', async (c) => {
  // TODO: Wire up DealRepository
  return c.json([]);
});

dealRoutes.get('/api/v1/revops/deals/:dealId', async (c) => {
  const { dealId } = c.req.param();
  // TODO: Wire up DealRepository
  return c.json({ id: dealId }, 404);
});

dealRoutes.post('/api/v1/revops/deals', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up DealRepository
  return c.json({ ...body, id: crypto.randomUUID() }, 201);
});

dealRoutes.put('/api/v1/revops/deals/:dealId/stage', async (c) => {
  const { dealId } = c.req.param();
  const body = await c.req.json();
  // TODO: Wire up DealRepository
  return c.json({ id: dealId, stage: body.stage });
});

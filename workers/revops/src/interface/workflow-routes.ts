import { Hono } from 'hono';
import type { Env } from '../app.js';

export const workflowRoutes = new Hono<Env>();

workflowRoutes.get('/api/v1/revops/workflows', async (c) => {
  // TODO: Wire up WorkflowRepository
  return c.json([]);
});

workflowRoutes.post('/api/v1/revops/workflows', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up WorkflowRepository
  return c.json({ ...body, id: crypto.randomUUID() }, 201);
});

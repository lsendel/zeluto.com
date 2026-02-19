import { Hono } from 'hono';
import type { Env } from '../app.js';

export const routingRoutes = new Hono<Env>();

routingRoutes.get('/api/v1/revops/routing/rules', async (c) => {
  // TODO: Wire up RoutingRuleRepository
  return c.json([]);
});

routingRoutes.post('/api/v1/revops/routing/rules', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up RoutingRuleRepository
  return c.json({ ...body, id: crypto.randomUUID() }, 201);
});

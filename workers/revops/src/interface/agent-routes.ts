import { Hono } from 'hono';
import type { Env } from '../app.js';

export const agentRoutes = new Hono<Env>();

agentRoutes.post('/api/v1/revops/agents/email-copilot', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up EmailCopilot
  return c.json({ primary: { subject: '', body: '', personalizationTokens: [] } });
});

agentRoutes.post('/api/v1/revops/agents/sales-coach', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up SalesCoach
  return c.json({ score: 0, strengths: [], improvements: [] });
});

agentRoutes.post('/api/v1/revops/agents/deal-inspector/:dealId', async (c) => {
  const { dealId } = c.req.param();
  // TODO: Wire up DealInspector
  return c.json({ dealId, riskLevel: 'healthy', flags: [], recommendations: [], score: 100 });
});

agentRoutes.post('/api/v1/revops/activities', async (c) => {
  const body = await c.req.json();
  // TODO: Wire up ActivityRepository
  return c.json({ ...body, id: crypto.randomUUID() }, 201);
});

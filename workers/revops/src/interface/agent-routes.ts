import { Hono } from 'hono';
import type { Env } from '../app.js';
import { createActivity } from '../infrastructure/repositories/activity-repository.js';

export const agentRoutes = new Hono<Env>();

agentRoutes.post('/api/v1/revops/agents/email-copilot', async (c) => {
  const tenant = c.get('tenant');

  try {
    const body = await c.req.json();
    // TODO: Wire up EmailCopilot with LLM provider
    return c.json({ primary: { subject: '', body: '', personalizationTokens: [] } });
  } catch (error) {
    console.error('Email copilot error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to generate email' }, 500);
  }
});

agentRoutes.post('/api/v1/revops/agents/sales-coach', async (c) => {
  const tenant = c.get('tenant');

  try {
    const body = await c.req.json();
    // TODO: Wire up SalesCoach with LLM provider
    return c.json({ score: 0, strengths: [], improvements: [] });
  } catch (error) {
    console.error('Sales coach error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to coach' }, 500);
  }
});

agentRoutes.post('/api/v1/revops/agents/deal-inspector/:dealId', async (c) => {
  const tenant = c.get('tenant');
  const { dealId } = c.req.param();

  try {
    // TODO: Wire up DealInspector with LLM provider
    return c.json({ dealId, riskLevel: 'healthy', flags: [], recommendations: [], score: 100 });
  } catch (error) {
    console.error('Deal inspector error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to inspect deal' }, 500);
  }
});

agentRoutes.post('/api/v1/revops/activities', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const activity = await createActivity(db, tenant.organizationId, body);
    return c.json(activity, 201);
  } catch (error) {
    console.error('Log activity error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to log activity' }, 500);
  }
});

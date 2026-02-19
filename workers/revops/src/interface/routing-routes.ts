import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findRulesByOrganization, createRule } from '../infrastructure/repositories/routing-rule-repository.js';

export const routingRoutes = new Hono<Env>();

routingRoutes.get('/api/v1/revops/routing/rules', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const rules = await findRulesByOrganization(db, tenant.organizationId);
    return c.json(rules);
  } catch (error) {
    console.error('List routing rules error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list routing rules' }, 500);
  }
});

routingRoutes.post('/api/v1/revops/routing/rules', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const rule = await createRule(db, tenant.organizationId, body);
    return c.json(rule, 201);
  } catch (error) {
    console.error('Create routing rule error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create routing rule' }, 500);
  }
});

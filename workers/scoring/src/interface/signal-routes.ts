import { Hono } from 'hono';
import type { Env } from '../app.js';
import { DrizzleIntentSignalRepository } from '../infrastructure/drizzle-intent-signal-repository.js';

export const signalRoutes = new Hono<Env>();

// GET /api/v1/scoring/contacts/:contactId/signals
signalRoutes.get('/api/v1/scoring/contacts/:contactId/signals', async (c) => {
  const { contactId } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant');
  const active = c.req.query('active');
  const repo = new DrizzleIntentSignalRepository(db);

  const signals =
    active === 'true'
      ? await repo.findActiveByContact(tenant.organizationId, contactId)
      : await repo.findByContact(tenant.organizationId, contactId);

  return c.json(signals.map((s) => s.toProps()));
});

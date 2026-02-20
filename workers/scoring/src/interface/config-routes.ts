import { Hono } from 'hono';
import type { Env } from '../app.js';
import { DrizzleScoringConfigRepository } from '../infrastructure/drizzle-scoring-config-repository.js';

export const configRoutes = new Hono<Env>();

// GET /api/v1/scoring/scoring/config
configRoutes.get('/api/v1/scoring/scoring/config', async (c) => {
  const db = c.get('db');
  const tenant = c.get('tenant');
  const repo = new DrizzleScoringConfigRepository(db);
  const configs = await repo.findByOrganization(tenant.organizationId);
  return c.json(configs);
});

// PUT /api/v1/scoring/scoring/config
configRoutes.put('/api/v1/scoring/scoring/config', async (c) => {
  const db = c.get('db');
  const tenant = c.get('tenant');
  const body = await c.req.json();
  const repo = new DrizzleScoringConfigRepository(db);

  const configs = (Array.isArray(body) ? body : [body]).map((entry: any) => ({
    id: entry.id ?? crypto.randomUUID(),
    organizationId: tenant.organizationId,
    category: String(entry.category),
    factor: String(entry.factor),
    weight: Number(entry.weight),
    enabled: entry.enabled !== false,
  }));

  await repo.saveBatch(configs);
  return c.json({ message: 'Configuration updated', count: configs.length });
});

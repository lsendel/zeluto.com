import { Hono } from 'hono';
import type { Env } from '../app.js';
import { DrizzleSignalAlertRepository } from '../infrastructure/drizzle-signal-alert-repository.js';

export const alertRoutes = new Hono<Env>();

// GET /api/v1/scoring/signals/alerts
alertRoutes.get('/api/v1/scoring/signals/alerts', async (c) => {
  const db = c.get('db');
  const tenant = c.get('tenant');
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const limit = c.req.query('limit');
  const repo = new DrizzleSignalAlertRepository(db);

  const alerts = await repo.findByOrganization(tenant.organizationId, {
    status: status ?? undefined,
    priority: priority ?? undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return c.json(alerts.map((a) => a.toProps()));
});

// POST /api/v1/scoring/signals/alerts/:alertId/acknowledge
alertRoutes.post(
  '/api/v1/scoring/signals/alerts/:alertId/acknowledge',
  async (c) => {
    const { alertId } = c.req.param();
    const db = c.get('db');
    const tenant = c.get('tenant');
    const body = await c.req.json();
    const repo = new DrizzleSignalAlertRepository(db);

    const alert = await repo.findById(tenant.organizationId, alertId);
    if (!alert) {
      return c.json({ error: 'Alert not found' }, 404);
    }

    alert.acknowledge(body.userId ?? tenant.organizationId);
    await repo.save(alert);

    return c.json({ message: 'Alert acknowledged', alert: alert.toProps() });
  },
);

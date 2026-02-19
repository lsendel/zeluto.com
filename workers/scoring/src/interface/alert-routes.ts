import { Hono } from 'hono';
import type { Env } from '../app.js';

export const alertRoutes = new Hono<Env>();

// GET /api/v1/scoring/signals/alerts
alertRoutes.get('/api/v1/scoring/signals/alerts', async (c) => {
  // TODO: Wire up SignalAlertRepository
  return c.json([]);
});

// POST /api/v1/scoring/signals/alerts/:alertId/acknowledge
alertRoutes.post('/api/v1/scoring/signals/alerts/:alertId/acknowledge', async (c) => {
  const { alertId } = c.req.param();

  // TODO: Wire up SignalAlertRepository + acknowledge
  return c.json({ message: 'Alert acknowledged' });
});

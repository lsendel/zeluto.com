import { Hono } from 'hono';
import type { Env } from '../app.js';

export const scoreRoutes = new Hono<Env>();

// GET /api/v1/scoring/contacts/:contactId/score
scoreRoutes.get('/api/v1/scoring/contacts/:contactId/score', async (c) => {
  const { contactId } = c.req.param();
  const tenant = c.get('tenant');

  // TODO: Wire up LeadScoreRepository
  return c.json({
    contactId,
    organizationId: tenant.organizationId,
    totalScore: 0,
    grade: 'F',
  });
});

// GET /api/v1/scoring/contacts/:contactId/score/history
scoreRoutes.get(
  '/api/v1/scoring/contacts/:contactId/score/history',
  async (c) => {
    const { contactId } = c.req.param();

    // TODO: Wire up ScoreHistoryRepository
    return c.json([]);
  },
);

// POST /api/v1/scoring/scoring/recalculate
scoreRoutes.post('/api/v1/scoring/scoring/recalculate', async (c) => {
  const _body = await c.req.json();

  // TODO: Enqueue scoring jobs via EVENTS queue
  return c.json({ message: 'Recalculation started', contactsProcessed: 0 });
});

// GET /api/v1/scoring/scoring/leaderboard
scoreRoutes.get('/api/v1/scoring/scoring/leaderboard', async (c) => {
  // TODO: Wire up LeadScoreRepository.findLeaderboard
  return c.json([]);
});

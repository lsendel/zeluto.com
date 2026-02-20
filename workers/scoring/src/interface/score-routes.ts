import { Hono } from 'hono';
import type { Env } from '../app.js';
import { DrizzleLeadScoreRepository } from '../infrastructure/drizzle-lead-score-repository.js';
import { DrizzleScoreHistoryRepository } from '../infrastructure/drizzle-score-history-repository.js';

export const scoreRoutes = new Hono<Env>();

// GET /api/v1/scoring/contacts/:contactId/score
scoreRoutes.get('/api/v1/scoring/contacts/:contactId/score', async (c) => {
  const { contactId } = c.req.param();
  const db = c.get('db');
  const tenant = c.get('tenant');
  const repo = new DrizzleLeadScoreRepository(db);
  const score = await repo.findByContact(tenant.organizationId, contactId);

  if (!score) {
    return c.json(
      {
        contactId,
        organizationId: tenant.organizationId,
        totalScore: 0,
        grade: 'F',
      },
      200,
    );
  }

  return c.json(score.toProps());
});

// GET /api/v1/scoring/contacts/:contactId/score/history
scoreRoutes.get(
  '/api/v1/scoring/contacts/:contactId/score/history',
  async (c) => {
    const { contactId } = c.req.param();
    const db = c.get('db');
    const tenant = c.get('tenant');
    const repo = new DrizzleScoreHistoryRepository(db);

    const from = c.req.query('from');
    const to = c.req.query('to');
    const limit = c.req.query('limit');

    const history = await repo.findByContact(tenant.organizationId, contactId, {
      from: from ?? undefined,
      to: to ?? undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return c.json(history.map((h) => h.toProps()));
  },
);

// POST /api/v1/scoring/scoring/recalculate
scoreRoutes.post('/api/v1/scoring/scoring/recalculate', async (c) => {
  const body = await c.req.json();
  const tenant = c.get('tenant');
  const queue = c.env.EVENTS;

  const contactIds: string[] = Array.isArray(body.contactIds)
    ? body.contactIds
    : [];

  if (contactIds.length === 0) {
    await queue.send({
      type: 'scoring.BatchRecompute',
      scheduledFor: new Date().toISOString(),
    });
    return c.json({ message: 'Batch recalculation enqueued' });
  }

  const messages = contactIds.map((contactId) => ({
    body: {
      type: 'scoring.CalculateScore' as const,
      data: {
        organizationId: tenant.organizationId,
        contactId,
      },
    },
  }));

  for (let i = 0; i < messages.length; i += 100) {
    await queue.sendBatch(messages.slice(i, i + 100) as any);
  }

  return c.json({
    message: 'Recalculation started',
    contactsProcessed: contactIds.length,
  });
});

// GET /api/v1/scoring/scoring/leaderboard
scoreRoutes.get('/api/v1/scoring/scoring/leaderboard', async (c) => {
  const db = c.get('db');
  const tenant = c.get('tenant');
  const limit = c.req.query('limit');
  const repo = new DrizzleLeadScoreRepository(db);
  const leaders = await repo.findLeaderboard(
    tenant.organizationId,
    limit ? Number(limit) : 20,
  );
  return c.json(leaders.map((l) => l.toProps()));
});

import {
  getDaysSinceStart,
  getWarmupLimit,
  getWarmupProgress,
  isWarmupComplete,
} from '@mauntic/delivery-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findAllSendingDomains,
  findSendingDomainById,
} from '../infrastructure/repositories/sending-domain-repository.js';

export const warmupRoutes = new Hono<Env>();

// GET /api/v1/delivery/warmup - List warmup status for all domains
warmupRoutes.get('/api/v1/delivery/warmup', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const domains = await findAllSendingDomains(db, tenant.organizationId);

    const warmupStatuses = domains
      .filter((d) => d.status === 'verified' || d.status === 'pending')
      .map((domain) => {
        const daysSinceStart = getDaysSinceStart(new Date(domain.created_at));
        const dailyLimit = getWarmupLimit(daysSinceStart);
        const completed = isWarmupComplete(daysSinceStart);

        return {
          id: domain.id,
          domain: domain.domain,
          dailyLimit: dailyLimit === Infinity ? null : dailyLimit,
          currentDay: daysSinceStart,
          startedAt: domain.created_at.toISOString(),
          completedAt: completed ? domain.created_at.toISOString() : null,
        };
      });

    return c.json(warmupStatuses);
  } catch (error) {
    console.error('List warmup error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list warmup status' },
      500,
    );
  }
});

// GET /api/v1/delivery/warmup/:id/progress - Get warmup progress for a domain
warmupRoutes.get('/api/v1/delivery/warmup/:id/progress', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const domain = await findSendingDomainById(db, tenant.organizationId, id);
    if (!domain) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Sending domain not found' },
        404,
      );
    }

    const daysSinceStart = getDaysSinceStart(new Date(domain.created_at));
    const currentDayLimit = getWarmupLimit(daysSinceStart);
    const progress = getWarmupProgress(daysSinceStart);
    const completed = isWarmupComplete(daysSinceStart);

    // In a full implementation, we would query actual sent counts for today
    const sentToday = 0;
    const remainingToday =
      currentDayLimit === Infinity
        ? Infinity
        : Math.max(0, currentDayLimit - sentToday);

    return c.json({
      schedule: {
        id: domain.id,
        domain: domain.domain,
        dailyLimit: currentDayLimit === Infinity ? null : currentDayLimit,
        currentDay: daysSinceStart,
        startedAt: domain.created_at.toISOString(),
        completedAt: completed ? domain.created_at.toISOString() : null,
      },
      currentDayLimit: currentDayLimit === Infinity ? -1 : currentDayLimit,
      sentToday,
      remainingToday: remainingToday === Infinity ? -1 : remainingToday,
      progressPercentage: progress,
    });
  } catch (error) {
    console.error('Get warmup progress error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get warmup progress' },
      500,
    );
  }
});

import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findDealById,
  findDealsByOrganization,
  findDealsByStage,
  createDeal,
  updateDeal,
  countDealsByStage,
} from '../infrastructure/repositories/deal-repository.js';

export const dealRoutes = new Hono<Env>();

dealRoutes.get('/api/v1/revops/deals', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '20', stage } = c.req.query();

  try {
    if (stage) {
      const data = await findDealsByStage(db, tenant.organizationId, stage);
      return c.json({ items: data, total: data.length });
    }

    const result = await findDealsByOrganization(db, tenant.organizationId, {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });

    return c.json({ items: result.data, total: result.total });
  } catch (error) {
    console.error('List deals error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list deals' }, 500);
  }
});

dealRoutes.get('/api/v1/revops/deals/:dealId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { dealId } = c.req.param();

  try {
    const deal = await findDealById(db, tenant.organizationId, dealId);
    if (!deal) return c.json({ code: 'NOT_FOUND', message: 'Deal not found' }, 404);
    return c.json(deal);
  } catch (error) {
    console.error('Get deal error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get deal' }, 500);
  }
});

dealRoutes.post('/api/v1/revops/deals', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const deal = await createDeal(db, tenant.organizationId, body);
    return c.json(deal, 201);
  } catch (error) {
    console.error('Create deal error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create deal' }, 500);
  }
});

dealRoutes.put('/api/v1/revops/deals/:dealId/stage', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { dealId } = c.req.param();

  try {
    const body = await c.req.json<{ stage: string }>();
    const deal = await updateDeal(db, tenant.organizationId, dealId, { stage: body.stage });
    if (!deal) return c.json({ code: 'NOT_FOUND', message: 'Deal not found' }, 404);

    await c.env.EVENTS.send({
      type: 'revops.DealStageChanged',
      data: { dealId, organizationId: tenant.organizationId, stage: body.stage },
    });

    return c.json(deal);
  } catch (error) {
    console.error('Update deal stage error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update deal stage' }, 500);
  }
});

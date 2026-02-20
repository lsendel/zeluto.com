import { PointRule } from '@mauntic/campaign-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createPointRule,
  deletePointRule,
  findPointLogByContact,
  findPointRuleById,
  findPointRulesByOrganization,
  getContactTotalPoints,
  updatePointRule,
} from '../infrastructure/repositories/point-rule-repository.js';

export const pointRoutes = new Hono<Env>();

// GET /api/v1/campaign/points/rules - List point rules
pointRoutes.get('/api/v1/campaign/points/rules', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '20' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const result = await findPointRulesByOrganization(db, tenant.organizationId, {
    page: pageNum,
    limit: limitNum,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(result.total / limitNum),
  });
});

// POST /api/v1/campaign/points/rules - Create point rule
pointRoutes.post('/api/v1/campaign/points/rules', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = await c.req.json<{
    eventType: string;
    points: number;
    description?: string;
  }>();

  if (!body.eventType || body.points === undefined) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'eventType and points are required',
      },
      400,
    );
  }

  const entity = PointRule.create({
    organizationId: tenant.organizationId,
    eventType: body.eventType as any,
    points: body.points,
    description: body.description,
  });

  const props = entity.toProps();
  const rule = await createPointRule(db, {
    id: props.id,
    organizationId: props.organizationId,
    eventType: props.eventType,
    points: props.points,
    description: props.description,
    isActive: props.isActive,
  });

  return c.json(rule, 201);
});

// GET /api/v1/campaign/points/rules/:id - Get point rule by ID
pointRoutes.get('/api/v1/campaign/points/rules/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const rule = await findPointRuleById(db, tenant.organizationId, id);
  if (!rule) {
    return c.json({ code: 'NOT_FOUND', message: 'Point rule not found' }, 404);
  }

  return c.json(rule);
});

// PATCH /api/v1/campaign/points/rules/:id - Update point rule
pointRoutes.patch('/api/v1/campaign/points/rules/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json<{
    points?: number;
    description?: string | null;
    isActive?: boolean;
  }>();

  const existing = await findPointRuleById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Point rule not found' }, 404);
  }

  // Validate via entity
  if (body.points !== undefined || body.description !== undefined) {
    const entity = PointRule.reconstitute({
      ...existing,
      eventType: existing.eventType as any,
    });
    entity.update({
      points: body.points,
      description: body.description,
    });
  }

  const updated = await updatePointRule(db, tenant.organizationId, id, body);
  return c.json(updated);
});

// DELETE /api/v1/campaign/points/rules/:id - Delete point rule
pointRoutes.delete('/api/v1/campaign/points/rules/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await findPointRuleById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Point rule not found' }, 404);
  }

  await deletePointRule(db, tenant.organizationId, id);
  return c.json({ success: true });
});

// GET /api/v1/campaign/points/contacts/:contactId - Get contact points
pointRoutes.get('/api/v1/campaign/points/contacts/:contactId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.param('contactId');

  const totalPoints = await getContactTotalPoints(
    db,
    tenant.organizationId,
    contactId,
  );

  return c.json({
    contactId,
    totalPoints,
  });
});

// GET /api/v1/campaign/points/contacts/:contactId/log - Get contact point log
pointRoutes.get(
  '/api/v1/campaign/points/contacts/:contactId/log',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const contactId = c.req.param('contactId');
    const { page = '1', limit = '20' } = c.req.query();

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await findPointLogByContact(
      db,
      tenant.organizationId,
      contactId,
      {
        page: pageNum,
        limit: limitNum,
      },
    );

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  },
);

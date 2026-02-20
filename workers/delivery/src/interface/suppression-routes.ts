import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createSuppression,
  deleteSuppression,
  findAllSuppressions,
  isEmailSuppressed,
} from '../infrastructure/repositories/suppression-repository.js';

export const suppressionRoutes = new Hono<Env>();

// GET /api/v1/delivery/suppressions - List suppressions (paginated)
suppressionRoutes.get('/api/v1/delivery/suppressions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', reason } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllSuppressions(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      reason: reason || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List suppressions error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list suppressions' },
      500,
    );
  }
});

// GET /api/v1/delivery/suppressions/check - Check if email is suppressed
suppressionRoutes.get('/api/v1/delivery/suppressions/check', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const email = c.req.query('email');

  if (!email) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'email query parameter is required',
      },
      400,
    );
  }

  try {
    const result = await isEmailSuppressed(db, tenant.organizationId, email);
    return c.json(result);
  } catch (error) {
    console.error('Check suppression error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to check suppression' },
      500,
    );
  }
});

// POST /api/v1/delivery/suppressions - Add suppression
suppressionRoutes.post('/api/v1/delivery/suppressions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      email: string;
      reason: string;
      source?: string;
    }>();

    if (!body.email) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'email is required' },
        400,
      );
    }

    const validReasons = ['bounce', 'complaint', 'unsubscribe', 'manual'];
    if (!body.reason || !validReasons.includes(body.reason)) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: `reason must be one of: ${validReasons.join(', ')}`,
        },
        400,
      );
    }

    // Check if already suppressed
    const existing = await isEmailSuppressed(
      db,
      tenant.organizationId,
      body.email,
    );
    if (existing.suppressed) {
      return c.json(
        {
          code: 'CONFLICT',
          message: `Email ${body.email} is already suppressed`,
        },
        400,
      );
    }

    const suppression = await createSuppression(db, tenant.organizationId, {
      email: body.email,
      reason: body.reason,
      source: body.source ?? null,
    });

    return c.json(suppression, 201);
  } catch (error) {
    console.error('Add suppression error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to add suppression' },
      500,
    );
  }
});

// DELETE /api/v1/delivery/suppressions/:id - Remove suppression
suppressionRoutes.delete('/api/v1/delivery/suppressions/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteSuppression(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Suppression not found' },
        404,
      );
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete suppression error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete suppression' },
      500,
    );
  }
});

import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findWaterfallsByOrganization, upsertWaterfall } from '../infrastructure/repositories/waterfall-config-repository.js';

export const waterfallRoutes = new Hono<Env>();

// GET /api/v1/lead-intelligence/waterfall
waterfallRoutes.get('/api/v1/lead-intelligence/waterfall', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const configs = await findWaterfallsByOrganization(db, tenant.organizationId);
    return c.json(configs);
  } catch (error) {
    console.error('List waterfall configs error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list waterfall configs' }, 500);
  }
});

// PUT /api/v1/lead-intelligence/waterfall/:fieldName
waterfallRoutes.put('/api/v1/lead-intelligence/waterfall/:fieldName', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const fieldName = c.req.param('fieldName');

  try {
    const body = await c.req.json<{
      providerOrder: string[];
      maxAttempts?: number;
      timeoutMs?: number;
      minConfidence?: number;
      cacheTtlDays?: number;
      maxCostPerLead?: number | null;
    }>();

    if (!body.providerOrder?.length) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'providerOrder must have at least 1 entry' }, 400);
    }

    const config = await upsertWaterfall(db, tenant.organizationId, {
      field_name: fieldName,
      provider_order: body.providerOrder,
      max_attempts: body.maxAttempts ?? 3,
      timeout_ms: body.timeoutMs ?? 5000,
      min_confidence: String(body.minConfidence ?? 0.5),
      cache_ttl_days: body.cacheTtlDays ?? 7,
      max_cost_per_lead: body.maxCostPerLead != null ? String(body.maxCostPerLead) : null,
    });

    return c.json(config);
  } catch (error) {
    console.error('Configure waterfall error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to configure waterfall' }, 500);
  }
});

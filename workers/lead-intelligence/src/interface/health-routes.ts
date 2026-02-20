import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findHealthByOrganization } from '../infrastructure/repositories/provider-health-repository.js';

export const healthRoutes = new Hono<Env>();

// GET /api/v1/lead-intelligence/health
healthRoutes.get('/api/v1/lead-intelligence/health', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const health = await findHealthByOrganization(db, tenant.organizationId);
    return c.json(
      health.map((h) => ({
        providerId: h.provider_id,
        successCount: h.success_count,
        failureCount: h.failure_count,
        circuitState: h.circuit_state,
        lastFailureAt: h.last_failure_at?.toISOString() ?? null,
        lastSuccessAt: h.last_success_at?.toISOString() ?? null,
      })),
    );
  } catch (error) {
    console.error('Get provider health error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get provider health' },
      500,
    );
  }
});

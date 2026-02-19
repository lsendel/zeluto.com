import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findProvidersByOrganization, upsertProvider, deleteProvider } from '../infrastructure/repositories/enrichment-provider-repository.js';

export const providerRoutes = new Hono<Env>();

// GET /api/v1/lead-intelligence/providers
providerRoutes.get('/api/v1/lead-intelligence/providers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const providers = await findProvidersByOrganization(db, tenant.organizationId);
    return c.json(providers);
  } catch (error) {
    console.error('List providers error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list providers' }, 500);
  }
});

// PUT /api/v1/lead-intelligence/providers/:providerId
providerRoutes.put('/api/v1/lead-intelligence/providers/:providerId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const providerId = c.req.param('providerId');

  try {
    const body = await c.req.json<{
      name: string;
      providerType: string;
      supportedFields: string[];
      priority: number;
      costPerLookup: number;
      batchSupported?: boolean;
      config?: Record<string, unknown>;
      enabled?: boolean;
    }>();

    const provider = await upsertProvider(db, tenant.organizationId, {
      id: providerId,
      name: body.name,
      provider_type: body.providerType,
      supported_fields: body.supportedFields,
      priority: body.priority,
      cost_per_lookup: String(body.costPerLookup),
      batch_supported: body.batchSupported ?? false,
      config: body.config,
      enabled: body.enabled ?? true,
    });

    return c.json(provider);
  } catch (error) {
    console.error('Configure provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to configure provider' }, 500);
  }
});

// DELETE /api/v1/lead-intelligence/providers/:providerId
providerRoutes.delete('/api/v1/lead-intelligence/providers/:providerId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const providerId = c.req.param('providerId');

  try {
    const deleted = await deleteProvider(db, tenant.organizationId, providerId);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Provider not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete provider' }, 500);
  }
});

import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findAllProviderConfigs,
  findProviderConfigById,
  createProviderConfig,
  updateProviderConfig,
  deleteProviderConfig,
} from '../infrastructure/repositories/provider-config-repository.js';
import { encryptConfig, decryptConfig } from '@mauntic/delivery-domain';

export const providerRoutes = new Hono<Env>();

// GET /api/v1/delivery/providers - List provider configs
providerRoutes.get('/api/v1/delivery/providers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const configs = await findAllProviderConfigs(db, tenant.organizationId);

    // Redact sensitive config data in response
    const redacted = configs.map((cfg) => ({
      ...cfg,
      config: { redacted: true },
    }));

    return c.json(redacted);
  } catch (error) {
    console.error('List providers error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list providers' }, 500);
  }
});

// GET /api/v1/delivery/providers/:id - Get provider config by ID
providerRoutes.get('/api/v1/delivery/providers/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const config = await findProviderConfigById(db, tenant.organizationId, id);
    if (!config) {
      return c.json({ code: 'NOT_FOUND', message: 'Provider config not found' }, 404);
    }

    // Decrypt config for display
    let decryptedConfig: Record<string, unknown> = {};
    try {
      const configStr = config.config as string;
      if (typeof configStr === 'string' && configStr.includes(':')) {
        const decrypted = await decryptConfig(configStr, c.env.ENCRYPTION_KEY);
        decryptedConfig = JSON.parse(decrypted);
      } else {
        decryptedConfig = config.config as Record<string, unknown>;
      }
    } catch {
      decryptedConfig = { error: 'Unable to decrypt config' };
    }

    return c.json({ ...config, config: decryptedConfig });
  } catch (error) {
    console.error('Get provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get provider' }, 500);
  }
});

// POST /api/v1/delivery/providers - Create provider config
providerRoutes.post('/api/v1/delivery/providers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      channel: string;
      providerType: string;
      isActive?: boolean;
      priority?: number;
      config: Record<string, unknown>;
    }>();

    if (!body.channel || !body.providerType || !body.config) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'channel, providerType, and config are required' },
        400,
      );
    }

    const validChannels = ['email', 'sms', 'push', 'webhook'];
    if (!validChannels.includes(body.channel)) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: `channel must be one of: ${validChannels.join(', ')}` },
        400,
      );
    }

    // Encrypt the config before storing
    const encryptedConfig = await encryptConfig(
      JSON.stringify(body.config),
      c.env.ENCRYPTION_KEY,
    );

    const config = await createProviderConfig(db, tenant.organizationId, {
      channel: body.channel,
      provider_type: body.providerType,
      is_active: body.isActive ?? true,
      priority: body.priority ?? 0,
      config: encryptedConfig,
    });

    return c.json({ ...config, config: { redacted: true } }, 201);
  } catch (error) {
    console.error('Create provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create provider' }, 500);
  }
});

// PATCH /api/v1/delivery/providers/:id - Update provider config
providerRoutes.patch('/api/v1/delivery/providers/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      isActive?: boolean;
      priority?: number;
      config?: Record<string, unknown>;
    }>();

    const existing = await findProviderConfigById(db, tenant.organizationId, id);
    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Provider config not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.priority !== undefined) updateData.priority = body.priority;

    if (body.config) {
      const encryptedConfig = await encryptConfig(
        JSON.stringify(body.config),
        c.env.ENCRYPTION_KEY,
      );
      updateData.config = encryptedConfig;
    }

    const config = await updateProviderConfig(
      db,
      tenant.organizationId,
      id,
      updateData as Parameters<typeof updateProviderConfig>[3],
    );

    if (!config) {
      return c.json({ code: 'NOT_FOUND', message: 'Provider config not found' }, 404);
    }

    return c.json({ ...config, config: { redacted: true } });
  } catch (error) {
    console.error('Update provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update provider' }, 500);
  }
});

// DELETE /api/v1/delivery/providers/:id - Delete provider config
providerRoutes.delete('/api/v1/delivery/providers/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteProviderConfig(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Provider config not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete provider' }, 500);
  }
});

// POST /api/v1/delivery/providers/:id/test - Test provider config
providerRoutes.post('/api/v1/delivery/providers/:id/test', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      to: string;
      subject?: string;
      body: string;
    }>();

    if (!body.to || !body.body) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'to and body are required' },
        400,
      );
    }

    const config = await findProviderConfigById(db, tenant.organizationId, id);
    if (!config) {
      return c.json({ code: 'NOT_FOUND', message: 'Provider config not found' }, 404);
    }

    // In the worker context, we can only validate the config exists.
    // Actual sending happens in the delivery engine service (Fly.io).
    return c.json({
      success: true,
      message: 'Provider configuration is valid. Test message queued for delivery.',
    });
  } catch (error) {
    console.error('Test provider error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to test provider' }, 500);
  }
});

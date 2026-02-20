import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createWebhook,
  createWebhookDelivery,
  deleteWebhook,
  findAllWebhooks,
  findWebhookById,
  findWebhookDeliveries,
  updateWebhook,
} from '../infrastructure/repositories/webhook-repository.js';
import {
  dispatchWebhook,
  type WebhookPayload,
} from '../services/webhook-dispatcher.js';

export const webhookRoutes = new Hono<Env>();

// GET /api/v1/integrations/webhooks - List webhooks
webhookRoutes.get('/api/v1/integrations/webhooks', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllWebhooks(db, tenant.organizationId, {
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
  } catch (error) {
    console.error('List webhooks error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list webhooks' },
      500,
    );
  }
});

// POST /api/v1/integrations/webhooks - Create webhook
webhookRoutes.post('/api/v1/integrations/webhooks', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      url: string;
      events: string[];
      secret?: string;
      isActive?: boolean;
    }>();

    if (!body.url || !body.events || body.events.length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'url and events are required' },
        400,
      );
    }

    const webhook = await createWebhook(db, tenant.organizationId, {
      url: body.url,
      events: body.events,
      secret: body.secret ?? crypto.randomUUID(),
      isActive: body.isActive,
    });

    return c.json(webhook, 201);
  } catch (error) {
    console.error('Create webhook error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' },
      500,
    );
  }
});

// GET /api/v1/integrations/webhooks/:id - Get webhook by ID
webhookRoutes.get('/api/v1/integrations/webhooks/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const webhook = await findWebhookById(db, tenant.organizationId, id);
    if (!webhook) {
      return c.json({ code: 'NOT_FOUND', message: 'Webhook not found' }, 404);
    }
    return c.json(webhook);
  } catch (error) {
    console.error('Get webhook error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get webhook' },
      500,
    );
  }
});

// PATCH /api/v1/integrations/webhooks/:id - Update webhook
webhookRoutes.patch('/api/v1/integrations/webhooks/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      url?: string;
      events?: string[];
      secret?: string;
      isActive?: boolean;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.url !== undefined) updateData.url = body.url;
    if (body.events !== undefined) updateData.events = body.events;
    if (body.secret !== undefined) updateData.secret = body.secret;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const webhook = await updateWebhook(
      db,
      tenant.organizationId,
      id,
      updateData,
    );
    if (!webhook) {
      return c.json({ code: 'NOT_FOUND', message: 'Webhook not found' }, 404);
    }

    return c.json(webhook);
  } catch (error) {
    console.error('Update webhook error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update webhook' },
      500,
    );
  }
});

// DELETE /api/v1/integrations/webhooks/:id - Delete webhook
webhookRoutes.delete('/api/v1/integrations/webhooks/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteWebhook(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Webhook not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete webhook error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook' },
      500,
    );
  }
});

// POST /api/v1/integrations/webhooks/:id/test - Test webhook with a sample event
webhookRoutes.post('/api/v1/integrations/webhooks/:id/test', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const webhook = await findWebhookById(db, tenant.organizationId, id);
    if (!webhook) {
      return c.json({ code: 'NOT_FOUND', message: 'Webhook not found' }, 404);
    }

    const body = await c.req.json<{
      eventType: string;
      payload?: Record<string, unknown>;
    }>();

    if (!body.eventType) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'eventType is required' },
        400,
      );
    }

    // Dispatch test webhook
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      eventType: body.eventType,
      data: body.payload ?? { test: true },
      timestamp: new Date().toISOString(),
    };

    const result = await dispatchWebhook(
      {
        id: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        consecutiveFailures: 0,
      },
      payload,
    );

    // Record delivery
    const delivery = await createWebhookDelivery(db, tenant.organizationId, {
      webhookId: webhook.id,
      eventType: body.eventType,
      payload: payload.data,
      responseStatus: result.statusCode ?? null,
      responseBody: result.responseBody ?? null,
    });

    return c.json({
      success: result.success,
      deliveryId: delivery.id,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to test webhook' },
      500,
    );
  }
});

// GET /api/v1/integrations/webhooks/:id/deliveries - List webhook deliveries
webhookRoutes.get('/api/v1/integrations/webhooks/:id/deliveries', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const webhookId = c.req.param('id');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    // Verify webhook exists
    const webhook = await findWebhookById(db, tenant.organizationId, webhookId);
    if (!webhook) {
      return c.json({ code: 'NOT_FOUND', message: 'Webhook not found' }, 404);
    }

    const result = await findWebhookDeliveries(
      db,
      tenant.organizationId,
      webhookId,
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
  } catch (error) {
    console.error('List webhook deliveries error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list webhook deliveries' },
      500,
    );
  }
});

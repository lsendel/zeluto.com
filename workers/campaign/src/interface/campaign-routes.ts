import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  DrizzleCampaignRepository,
  findCampaignStats, // Keep usage of stats query for now
} from '../infrastructure/repositories/campaign-repository.js';
import { CampaignService } from '../application/campaign-service.js';

export const campaignRoutes = new Hono<Env>();

// Helper to get service
function getService(c: any) {
  const db = c.get('db');
  const repo = new DrizzleCampaignRepository(db);
  return new CampaignService(repo, c.env.EVENTS);
}

// GET /api/v1/campaign/campaigns - List campaigns
campaignRoutes.get('/api/v1/campaign/campaigns', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '20', status, search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  // Access repository directly for reads (CQRS-lite)
  const repo = new DrizzleCampaignRepository(db);
  const result = await repo.findByOrganization(tenant.organizationId, {
    page: pageNum,
    limit: limitNum,
    status: status || undefined,
    search: search || undefined,
  });

  return c.json({
    data: result.data.map(c => c.toProps()), // Convert entities to DTOs
    total: result.total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(result.total / limitNum),
  });
});

// POST /api/v1/campaign/campaigns - Create campaign
campaignRoutes.post('/api/v1/campaign/campaigns', async (c) => {
  const tenant = c.get('tenant');
  const body = await c.req.json<{
    name: string;
    description?: string;
    type: string;
    subject?: string;
    templateId?: string;
    segmentId?: string;
  }>();

  if (!body.name || !body.type) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'name and type are required' },
      400,
    );
  }

  const service = getService(c);
  const campaign = await service.create({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    name: body.name,
    type: body.type,
    description: body.description,
    subject: body.subject,
    templateId: body.templateId,
    segmentId: body.segmentId,
  });

  return c.json(campaign.toProps(), 201);
});

// GET /api/v1/campaign/campaigns/:id - Get campaign by ID
campaignRoutes.get('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const repo = new DrizzleCampaignRepository(db);
  const campaign = await repo.findById(tenant.organizationId, id);

  if (!campaign) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json(campaign.toProps());
});

// PATCH /api/v1/campaign/campaigns/:id - Update campaign
campaignRoutes.patch('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string | null;
    subject?: string | null;
    templateId?: string | null;
    segmentId?: string | null;
  }>();

  const service = getService(c);
  try {
    const updated = await service.update(tenant.organizationId, id, body);
    return c.json(updated.toProps());
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
    }
    throw err;
  }
});

// DELETE /api/v1/campaign/campaigns/:id - Delete campaign
campaignRoutes.delete('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');

  const service = getService(c);
  await service.delete(tenant.organizationId, id);

  return c.json({ success: true });
});

// POST /api/v1/campaign/campaigns/:id/schedule - Schedule campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/schedule', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const body = await c.req.json<{ scheduledAt: string }>();

  const service = getService(c);
  try {
    const updated = await service.schedule(
      tenant.organizationId,
      id,
      new Date(body.scheduledAt),
      tenant.userId
    );
    return c.json(updated.toProps());
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
    }
    // Handle invariant violations (e.g. invalid state transition)
    if (err.name === 'InvariantViolation') {
      return c.json({ code: 'BAD_REQUEST', message: err.message }, 400);
    }
    throw err;
  }
});

// POST /api/v1/campaign/campaigns/:id/send - Send campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/send', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');

  const service = getService(c);
  try {
    const updated = await service.send(tenant.organizationId, id);
    return c.json(updated.toProps());
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
    }
    if (err.name === 'InvariantViolation') {
      return c.json({ code: 'BAD_REQUEST', message: err.message }, 400);
    }
    throw err;
  }
});

// POST /api/v1/campaign/campaigns/:id/pause - Pause campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/pause', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');

  const service = getService(c);
  try {
    const updated = await service.pause(tenant.organizationId, id, tenant.userId);
    return c.json(updated.toProps());
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
    }
    if (err.name === 'InvariantViolation') {
      return c.json({ code: 'BAD_REQUEST', message: err.message }, 400);
    }
    throw err;
  }
});

// POST /api/v1/campaign/campaigns/:id/resume - Resume campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/resume', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');

  const service = getService(c);
  try {
    const updated = await service.resume(tenant.organizationId, id);
    return c.json(updated.toProps());
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
    }
    if (err.name === 'InvariantViolation') {
      return c.json({ code: 'BAD_REQUEST', message: err.message }, 400);
    }
    throw err;
  }
});

// GET /api/v1/campaign/campaigns/:id/stats - Get campaign stats
campaignRoutes.get('/api/v1/campaign/campaigns/:id/stats', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const repo = new DrizzleCampaignRepository(db);
  const campaign = await repo.findById(tenant.organizationId, id);
  if (!campaign) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  // Use the standalone stats query for now
  const stats = await findCampaignStats(db, tenant.organizationId, id);
  if (!stats) {
    // Return zero stats
    return c.json({
      campaignId: id,
      totalRecipients: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
    });
  }

  return c.json(stats);
});

// POST /api/v1/campaign/campaigns/:id/clone - Clone campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/clone', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const repo = new DrizzleCampaignRepository(db);
  const existing = await repo.findById(tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  let cloneName = `${existing.name} (Copy)`;
  try {
    const body = await c.req.json<{ name?: string }>();
    if (body.name) {
      cloneName = body.name;
    }
  } catch {
    // No body provided, use default clone name
  }

  const service = getService(c);
  // We can use service.create for cloning if we extract props
  // or add a clone method to service.
  // For now, let's use service.create with props from existing.

  const campaign = await service.create({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    name: cloneName,
    type: existing.type,
    description: existing.description ?? undefined,
    subject: existing.subject ?? undefined,
    templateId: existing.templateId ?? undefined,
    segmentId: existing.segmentId ?? undefined,
  });

  return c.json(campaign.toProps(), 201);
});

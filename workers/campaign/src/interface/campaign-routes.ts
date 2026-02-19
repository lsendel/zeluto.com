import { Hono } from 'hono';
import { ZodError } from 'zod';
import { DomainError } from '@mauntic/domain-kernel';
import {
  CampaignApplicationService,
} from '@mauntic/campaign-domain';
import type { Env } from '../app.js';
import {
  DrizzleCampaignRepository,
  findCampaignStats,
} from '../infrastructure/repositories/campaign-repository.js';
import { QueueCampaignEventPublisher } from '../application/event-publisher.js';

export const campaignRoutes = new Hono<Env>();

function getService(c: any) {
  const db = c.get('db');
  const repo = new DrizzleCampaignRepository(db);
  const publisher = new QueueCampaignEventPublisher(c.env.EVENTS);
  return new CampaignApplicationService(repo, publisher);
}

function handleError(c: any, error: unknown) {
  if (error instanceof DomainError) {
    return c.json({ code: error.code, message: error.message }, error.statusCode);
  }
  if (error instanceof ZodError) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.flatten(),
      },
      400,
    );
  }

  throw error;
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
  const body = await c.req.json();
  const service = getService(c);

  try {
    const campaign = await service.create({
      organizationId: tenant.organizationId,
      name: body.name,
      description: body.description,
      type: body.type,
      subject: body.subject,
      templateId: body.templateId,
      segmentId: body.segmentId,
      createdBy: tenant.userId,
    });

    return c.json(campaign.toProps(), 201);
  } catch (error) {
    return handleError(c, error);
  }
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
  const body = await c.req.json();
  const service = getService(c);

  try {
    const updated = await service.update({
      organizationId: tenant.organizationId,
      campaignId: id,
      name: body.name,
      description: body.description,
      subject: body.subject,
      templateId: body.templateId,
      segmentId: body.segmentId,
    });
    return c.json(updated.toProps());
  } catch (error) {
    return handleError(c, error);
  }
});

// DELETE /api/v1/campaign/campaigns/:id - Delete campaign
campaignRoutes.delete('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const service = getService(c);

  try {
    await service.delete({
      organizationId: tenant.organizationId,
      campaignId: id,
    });
    return c.json({ success: true });
  } catch (error) {
    return handleError(c, error);
  }
});

// POST /api/v1/campaign/campaigns/:id/schedule - Schedule campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/schedule', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const body = await c.req.json<{ scheduledAt: string }>();
  const service = getService(c);

  try {
    const updated = await service.schedule({
      organizationId: tenant.organizationId,
      campaignId: id,
      scheduledAt: new Date(body.scheduledAt),
      scheduledBy: tenant.userId,
    });
    return c.json(updated.toProps());
  } catch (error) {
    return handleError(c, error);
  }
});

// POST /api/v1/campaign/campaigns/:id/send - Send campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/send', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const service = getService(c);

  try {
    const updated = await service.send({
      organizationId: tenant.organizationId,
      campaignId: id,
    });
    return c.json(updated.toProps());
  } catch (error) {
    return handleError(c, error);
  }
});

// POST /api/v1/campaign/campaigns/:id/pause - Pause campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/pause', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const service = getService(c);

  try {
    const updated = await service.pause({
      organizationId: tenant.organizationId,
      campaignId: id,
      pausedBy: tenant.userId,
    });
    return c.json(updated.toProps());
  } catch (error) {
    return handleError(c, error);
  }
});

// POST /api/v1/campaign/campaigns/:id/resume - Resume campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/resume', async (c) => {
  const tenant = c.get('tenant');
  const id = c.req.param('id');
  const service = getService(c);

  try {
    const updated = await service.resume({
      organizationId: tenant.organizationId,
      campaignId: id,
    });
    return c.json(updated.toProps());
  } catch (error) {
    return handleError(c, error);
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
  try {
    const campaign = await service.create({
      organizationId: tenant.organizationId,
      name: cloneName,
      type: existing.type,
      description: existing.description ?? undefined,
      subject: existing.subject ?? undefined,
      templateId: existing.templateId ?? undefined,
      segmentId: existing.segmentId ?? undefined,
      createdBy: tenant.userId,
    });

    return c.json(campaign.toProps(), 201);
  } catch (error) {
    return handleError(c, error);
  }
});

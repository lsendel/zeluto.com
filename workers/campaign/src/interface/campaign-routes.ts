import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findCampaignById,
  findCampaignsByOrganization,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  findCampaignStats,
  upsertCampaignStats,
} from '../infrastructure/repositories/campaign-repository.js';
import { Campaign } from '@mauntic/campaign-domain';

export const campaignRoutes = new Hono<Env>();

// GET /api/v1/campaign/campaigns - List campaigns
campaignRoutes.get('/api/v1/campaign/campaigns', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '20', status, search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const result = await findCampaignsByOrganization(db, tenant.organizationId, {
    page: pageNum,
    limit: limitNum,
    status: status || undefined,
    search: search || undefined,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(result.total / limitNum),
  });
});

// POST /api/v1/campaign/campaigns - Create campaign
campaignRoutes.post('/api/v1/campaign/campaigns', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
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

  const entity = Campaign.create({
    organizationId: tenant.organizationId,
    name: body.name,
    description: body.description,
    type: body.type as any,
    subject: body.subject,
    templateId: body.templateId,
    segmentId: body.segmentId,
    createdBy: tenant.userId,
  });

  const props = entity.toProps();
  const campaign = await createCampaign(db, {
    id: props.id,
    organizationId: props.organizationId,
    name: props.name,
    description: props.description,
    type: props.type,
    status: props.status,
    subject: props.subject,
    templateId: props.templateId,
    segmentId: props.segmentId,
    scheduledAt: props.scheduledAt,
    startedAt: props.startedAt,
    completedAt: props.completedAt,
    recipientCount: props.recipientCount,
    sentCount: props.sentCount,
    failedCount: props.failedCount,
    openRate: props.openRate,
    clickRate: props.clickRate,
    createdBy: props.createdBy,
  });

  // Publish campaign created event
  try {
    await c.env.EVENTS.send({
      type: 'campaign.CampaignCreated',
      data: {
        organizationId: tenant.organizationId,
        campaignId: campaign.id,
        name: campaign.name,
        createdBy: tenant.userId,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: campaign.id,
        tenantContext: { organizationId: tenant.organizationId },
      },
    });
  } catch (err) {
    console.error('Failed to publish CampaignCreated event:', err);
  }

  return c.json(campaign, 201);
});

// GET /api/v1/campaign/campaigns/:id - Get campaign by ID
campaignRoutes.get('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const campaign = await findCampaignById(db, tenant.organizationId, id);
  if (!campaign) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json(campaign);
});

// PATCH /api/v1/campaign/campaigns/:id - Update campaign
campaignRoutes.patch('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string | null;
    subject?: string | null;
    templateId?: string | null;
    segmentId?: string | null;
  }>();

  const existing = await findCampaignById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  // Use entity to validate state transitions
  const entity = Campaign.reconstitute({
    ...existing,
    type: existing.type as any,
    status: existing.status as any,
    openRate: existing.openRate,
    clickRate: existing.clickRate,
  });
  entity.update(body);

  const updated = await updateCampaign(db, tenant.organizationId, id, body);
  return c.json(updated);
});

// DELETE /api/v1/campaign/campaigns/:id - Delete campaign
campaignRoutes.delete('/api/v1/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await findCampaignById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  await deleteCampaign(db, tenant.organizationId, id);
  return c.json({ success: true });
});

// POST /api/v1/campaign/campaigns/:id/schedule - Schedule campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/schedule', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json<{ scheduledAt: string }>();

  const existing = await findCampaignById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const entity = Campaign.reconstitute({
    ...existing,
    type: existing.type as any,
    status: existing.status as any,
    openRate: existing.openRate,
    clickRate: existing.clickRate,
  });
  entity.schedule(new Date(body.scheduledAt));

  const props = entity.toProps();
  const updated = await updateCampaign(db, tenant.organizationId, id, {
    status: props.status,
    scheduledAt: props.scheduledAt,
  });

  // Publish scheduled event
  try {
    await c.env.EVENTS.send({
      type: 'campaign.CampaignScheduled',
      data: {
        organizationId: tenant.organizationId,
        campaignId: id,
        scheduledFor: body.scheduledAt,
        scheduledBy: tenant.userId,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: id,
        tenantContext: { organizationId: tenant.organizationId },
      },
    });
  } catch (err) {
    console.error('Failed to publish CampaignScheduled event:', err);
  }

  return c.json(updated);
});

// POST /api/v1/campaign/campaigns/:id/send - Send campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/send', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await findCampaignById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const entity = Campaign.reconstitute({
    ...existing,
    type: existing.type as any,
    status: existing.status as any,
    openRate: existing.openRate,
    clickRate: existing.clickRate,
  });
  entity.send();

  const props = entity.toProps();
  const updated = await updateCampaign(db, tenant.organizationId, id, {
    status: props.status,
    startedAt: props.startedAt,
  });

  // Publish CampaignSent event to trigger delivery
  try {
    await c.env.EVENTS.send({
      type: 'campaign.CampaignSent',
      data: {
        organizationId: tenant.organizationId,
        campaignId: id,
        contactCount: 0, // will be resolved by campaign-sender
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: id,
        tenantContext: { organizationId: tenant.organizationId },
      },
    });
  } catch (err) {
    console.error('Failed to publish CampaignSent event:', err);
  }

  return c.json(updated);
});

// POST /api/v1/campaign/campaigns/:id/pause - Pause campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/pause', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await findCampaignById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const entity = Campaign.reconstitute({
    ...existing,
    type: existing.type as any,
    status: existing.status as any,
    openRate: existing.openRate,
    clickRate: existing.clickRate,
  });
  entity.pause();

  const updated = await updateCampaign(db, tenant.organizationId, id, {
    status: 'paused',
  });

  try {
    await c.env.EVENTS.send({
      type: 'campaign.CampaignPaused',
      data: {
        organizationId: tenant.organizationId,
        campaignId: id,
        pausedBy: tenant.userId,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: id,
        tenantContext: { organizationId: tenant.organizationId },
      },
    });
  } catch (err) {
    console.error('Failed to publish CampaignPaused event:', err);
  }

  return c.json(updated);
});

// POST /api/v1/campaign/campaigns/:id/resume - Resume campaign
campaignRoutes.post('/api/v1/campaign/campaigns/:id/resume', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await findCampaignById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const entity = Campaign.reconstitute({
    ...existing,
    type: existing.type as any,
    status: existing.status as any,
    openRate: existing.openRate,
    clickRate: existing.clickRate,
  });
  entity.resume();

  const updated = await updateCampaign(db, tenant.organizationId, id, {
    status: 'sending',
  });

  return c.json(updated);
});

// GET /api/v1/campaign/campaigns/:id/stats - Get campaign stats
campaignRoutes.get('/api/v1/campaign/campaigns/:id/stats', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const campaign = await findCampaignById(db, tenant.organizationId, id);
  if (!campaign) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

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

  const existing = await findCampaignById(db, tenant.organizationId, id);
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

  const entity = Campaign.create({
    organizationId: tenant.organizationId,
    name: cloneName,
    description: existing.description,
    type: existing.type as any,
    subject: existing.subject,
    templateId: existing.templateId,
    segmentId: existing.segmentId,
    createdBy: tenant.userId,
  });

  const props = entity.toProps();
  const cloned = await createCampaign(db, {
    id: props.id,
    organizationId: props.organizationId,
    name: props.name,
    description: props.description,
    type: props.type,
    status: props.status,
    subject: props.subject,
    templateId: props.templateId,
    segmentId: props.segmentId,
    createdBy: props.createdBy,
  });

  return c.json(cloned, 201);
});

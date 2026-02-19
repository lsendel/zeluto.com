import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findAbTestById,
  findAbTestsByCampaign,
  createAbTest,
  updateAbTest,
} from '../infrastructure/repositories/ab-test-repository.js';
import { DrizzleCampaignRepository } from '../infrastructure/repositories/campaign-repository.js';
import { AbTest } from '@mauntic/campaign-domain';

export const abTestRoutes = new Hono<Env>();

// POST /api/v1/campaign/ab-tests - Create A/B test
abTestRoutes.post('/api/v1/campaign/ab-tests', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = await c.req.json<{
    campaignId: string;
    name: string;
    variants: Array<{
      id: string;
      name: string;
      subject?: string;
      templateId?: string;
      percentage: number;
    }>;
    winningCriteria: string;
    testPercentage?: number;
  }>();

  if (!body.campaignId || !body.name || !body.variants || !body.winningCriteria) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'campaignId, name, variants, and winningCriteria are required' },
      400,
    );
  }

  // Verify campaign exists
  const repo = new DrizzleCampaignRepository(db);
  const campaign = await repo.findById(tenant.organizationId, body.campaignId);
  if (!campaign) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const entity = AbTest.create({
    campaignId: body.campaignId,
    organizationId: tenant.organizationId,
    name: body.name,
    variants: body.variants,
    winnerCriteria: body.winningCriteria as any,
    testPercentage: body.testPercentage,
  });

  const props = entity.toProps();
  const test = await createAbTest(db, {
    id: props.id,
    campaignId: props.campaignId,
    organizationId: props.organizationId,
    name: props.name,
    variants: props.variants,
    winningCriteria: props.winnerCriteria,
    testPercentage: props.testPercentage,
    winnerVariantId: props.winnerVariantId,
    status: props.status,
    startedAt: props.startedAt,
    completedAt: props.completedAt,
  });

  // Publish event
  try {
    await c.env.EVENTS.send({
      type: 'campaign.AbTestStarted',
      data: {
        organizationId: tenant.organizationId,
        campaignId: body.campaignId,
        testId: test.id,
        variants: body.variants.length,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: test.id,
        tenantContext: { organizationId: tenant.organizationId },
      },
    });
  } catch (err) {
    console.error('Failed to publish AbTestStarted event:', err);
  }

  return c.json(test, 201);
});

// GET /api/v1/campaign/ab-tests/:id/results - Get A/B test results
abTestRoutes.get('/api/v1/campaign/ab-tests/:id/results', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  const test = await findAbTestById(db, tenant.organizationId, id);
  if (!test) {
    return c.json({ code: 'NOT_FOUND', message: 'A/B test not found' }, 404);
  }

  return c.json(test);
});

// POST /api/v1/campaign/ab-tests/:id/select-winner - Select A/B test winner
abTestRoutes.post('/api/v1/campaign/ab-tests/:id/select-winner', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json<{ winnerVariant: string }>();

  if (!body.winnerVariant) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'winnerVariant is required' },
      400,
    );
  }

  const existing = await findAbTestById(db, tenant.organizationId, id);
  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'A/B test not found' }, 404);
  }

  const entity = AbTest.reconstitute({
    ...existing,
    variants: existing.variants as any,
    winnerCriteria: existing.winningCriteria as any,
    testPercentage: existing.testPercentage,
    winnerVariantId: existing.winnerVariantId,
    status: existing.status as any,
  });
  entity.selectWinner(body.winnerVariant);

  const updated = await updateAbTest(db, tenant.organizationId, id, {
    winnerVariantId: body.winnerVariant,
    status: 'completed',
    completedAt: new Date(),
  });

  // Publish event
  try {
    await c.env.EVENTS.send({
      type: 'campaign.AbTestCompleted',
      data: {
        organizationId: tenant.organizationId,
        campaignId: existing.campaignId,
        testId: id,
        winnerId: body.winnerVariant,
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
    console.error('Failed to publish AbTestCompleted event:', err);
  }

  return c.json(updated);
});

// GET /api/v1/campaign/campaigns/:id/ab-tests - List A/B tests for a campaign
abTestRoutes.get('/api/v1/campaign/campaigns/:id/ab-tests', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const campaignId = c.req.param('id');

  const tests = await findAbTestsByCampaign(db, tenant.organizationId, campaignId);
  return c.json({ data: tests });
});

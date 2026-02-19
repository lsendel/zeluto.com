import { Hono } from 'hono';
import type { Env } from '../app.js';
import { ClaudeLLMProvider } from '../adapters/claude-llm-provider.js';
import { EmailCopilot, SalesCoach, DealInspector } from '@mauntic/revops-domain';
import { createActivity } from '../infrastructure/repositories/activity-repository.js';
import { findDealById } from '../infrastructure/repositories/deal-repository.js';
import { findActivitiesByDeal } from '../infrastructure/repositories/activity-repository.js';
import type { DealProps } from '@mauntic/revops-domain';
import type { ActivityProps } from '@mauntic/revops-domain';
import type { DealRow } from '../infrastructure/repositories/deal-repository.js';
import type { ActivityRow } from '../infrastructure/repositories/activity-repository.js';

/**
 * Map a database deal row (snake_case) to domain DealProps (camelCase).
 */
function mapDealRowToProps(row: DealRow): DealProps {
  return {
    id: row.id,
    organizationId: row.organization_id,
    accountId: row.account_id ?? undefined,
    contactId: row.contact_id,
    name: row.name,
    stage: row.stage as DealProps['stage'],
    value: Number(row.value),
    probability: row.probability,
    priority: row.priority as DealProps['priority'],
    assignedRep: row.assigned_rep ?? undefined,
    expectedCloseAt: row.expected_close_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    lostReason: row.lost_reason ?? undefined,
    notes: row.notes ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map a database activity row (snake_case) to domain ActivityProps (camelCase).
 */
function mapActivityRowToProps(row: ActivityRow): ActivityProps {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type as ActivityProps['type'],
    contactId: row.contact_id ?? undefined,
    dealId: row.deal_id ?? undefined,
    outcome: row.outcome ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    notes: row.notes ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

export const agentRoutes = new Hono<Env>();

agentRoutes.post('/api/v1/revops/agents/email-copilot', async (c) => {
  const tenant = c.get('tenant');

  try {
    const body = await c.req.json();
    const llm = new ClaudeLLMProvider(c.env.ANTHROPIC_API_KEY);
    const copilot = new EmailCopilot(llm);
    const result = await copilot.generate(body);
    return c.json(result);
  } catch (error) {
    console.error('Email copilot error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to generate email' }, 500);
  }
});

agentRoutes.post('/api/v1/revops/agents/sales-coach', async (c) => {
  const tenant = c.get('tenant');

  try {
    const body = await c.req.json();
    const llm = new ClaudeLLMProvider(c.env.ANTHROPIC_API_KEY);
    const coach = new SalesCoach(llm);
    const result = await coach.review(body);
    return c.json(result);
  } catch (error) {
    console.error('Sales coach error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to coach' }, 500);
  }
});

agentRoutes.post('/api/v1/revops/agents/deal-inspector/:dealId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { dealId } = c.req.param();

  try {
    const dealRow = await findDealById(db, tenant.organizationId, dealId);
    if (!dealRow) {
      return c.json({ code: 'NOT_FOUND', message: 'Deal not found' }, 404);
    }

    const activityRows = await findActivitiesByDeal(db, tenant.organizationId, dealId);

    const deal = mapDealRowToProps(dealRow);
    const activities = activityRows.map(mapActivityRowToProps);

    const inspector = new DealInspector();
    const report = inspector.inspect(deal, activities);
    return c.json(report);
  } catch (error) {
    console.error('Deal inspector error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to inspect deal' }, 500);
  }
});

agentRoutes.post('/api/v1/revops/activities', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const activity = await createActivity(db, tenant.organizationId, body);
    return c.json(activity, 201);
  } catch (error) {
    console.error('Log activity error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to log activity' }, 500);
  }
});

import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findTriggersByJourneyId,
  createTrigger,
  deleteTrigger,
} from '../infrastructure/repositories/trigger-repository.js';
import {
  findJourneyById,
} from '../infrastructure/repositories/journey-repository.js';

export const triggerRoutes = new Hono<Env>();

// GET /api/v1/journey/journeys/:id/triggers - List triggers for a journey
triggerRoutes.get('/api/v1/journey/journeys/:id/triggers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const triggers = await findTriggersByJourneyId(db, tenant.organizationId, journeyId);
    return c.json(triggers);
  } catch (error) {
    console.error('List triggers error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list triggers' }, 500);
  }
});

// POST /api/v1/journey/journeys/:id/triggers - Add trigger to journey
triggerRoutes.post('/api/v1/journey/journeys/:id/triggers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const body = await c.req.json<{
      type: string;
      config: Record<string, unknown>;
    }>();

    if (!body.type || !body.config) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'type and config are required' }, 400);
    }

    const validTypes = ['event', 'segment', 'manual', 'scheduled'];
    if (!validTypes.includes(body.type)) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: `type must be one of: ${validTypes.join(', ')}` },
        400,
      );
    }

    const trigger = await createTrigger(db, tenant.organizationId, {
      journey_id: journeyId,
      type: body.type,
      config: body.config,
    });

    return c.json(trigger, 201);
  } catch (error) {
    console.error('Create trigger error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create trigger' }, 500);
  }
});

// DELETE /api/v1/journey/triggers/:triggerId - Remove trigger
triggerRoutes.delete('/api/v1/journey/triggers/:triggerId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const triggerId = c.req.param('triggerId');

  try {
    const deleted = await deleteTrigger(db, tenant.organizationId, triggerId);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Trigger not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete trigger error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete trigger' }, 500);
  }
});

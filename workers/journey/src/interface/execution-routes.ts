import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findExecutionById,
  findExecutionsByJourneyId,
  findActiveExecutionForContact,
  createExecution,
  updateExecution,
  findStepExecutionsByExecutionId,
} from '../infrastructure/repositories/execution-repository.js';
import {
  findJourneyById,
} from '../infrastructure/repositories/journey-repository.js';
import {
  findLatestVersion,
} from '../infrastructure/repositories/version-repository.js';

export const executionRoutes = new Hono<Env>();

// GET /api/v1/journey/journeys/:id/executions - List executions (paginated)
executionRoutes.get('/api/v1/journey/journeys/:id/executions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');
  const { page = '1', limit = '25', status, contactId } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const result = await findExecutionsByJourneyId(db, tenant.organizationId, journeyId, {
      page: pageNum,
      limit: limitNum,
      status: status || undefined,
      contactId: contactId || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List executions error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list executions' }, 500);
  }
});

// GET /api/v1/journey/executions/:executionId - Get execution detail with step executions
executionRoutes.get('/api/v1/journey/executions/:executionId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const executionId = c.req.param('executionId');

  try {
    const execution = await findExecutionById(db, tenant.organizationId, executionId);
    if (!execution) {
      return c.json({ code: 'NOT_FOUND', message: 'Execution not found' }, 404);
    }

    const stepExecutions = await findStepExecutionsByExecutionId(
      db,
      tenant.organizationId,
      executionId,
    );

    return c.json({
      ...execution,
      steps: stepExecutions,
    });
  } catch (error) {
    console.error('Get execution error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get execution' }, 500);
  }
});

// POST /api/v1/journey/journeys/:id/executions - Start execution for a contact
executionRoutes.post('/api/v1/journey/journeys/:id/executions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    if (journey.status !== 'active') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Executions can only be started on active journeys' },
        400,
      );
    }

    const body = await c.req.json<{ contactId: string }>();
    if (!body.contactId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'contactId is required' }, 400);
    }

    // Check if contact already has an active execution in this journey
    const existingExecution = await findActiveExecutionForContact(
      db,
      tenant.organizationId,
      journeyId,
      body.contactId,
    );
    if (existingExecution) {
      return c.json(
        { code: 'CONFLICT', message: 'Contact already has an active execution in this journey' },
        400,
      );
    }

    const latestVersion = await findLatestVersion(db, tenant.organizationId, journeyId);
    if (!latestVersion) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Journey has no published version' },
        400,
      );
    }

    const execution = await createExecution(db, tenant.organizationId, {
      journey_id: journeyId,
      journey_version_id: latestVersion.id,
      contact_id: body.contactId,
      status: 'active',
    });

    // Enqueue the first step execution via the EVENTS queue
    try {
      await c.env.EVENTS.send({
        type: 'journey.ExecutionStarted',
        data: {
          organizationId: tenant.organizationId,
          journeyId,
          executionId: execution.id,
          contactId: body.contactId,
          versionId: latestVersion.id,
        },
        metadata: {
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (queueError) {
      console.error('Failed to enqueue execution start event:', queueError);
      // Execution was created; the event will be retried
    }

    return c.json(execution, 201);
  } catch (error) {
    console.error('Start execution error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to start execution' }, 500);
  }
});

// POST /api/v1/journey/executions/:executionId/cancel - Cancel execution
executionRoutes.post('/api/v1/journey/executions/:executionId/cancel', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const executionId = c.req.param('executionId');

  try {
    const execution = await findExecutionById(db, tenant.organizationId, executionId);
    if (!execution) {
      return c.json({ code: 'NOT_FOUND', message: 'Execution not found' }, 404);
    }

    if (execution.status !== 'active') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Only active executions can be canceled' },
        400,
      );
    }

    const updated = await updateExecution(db, tenant.organizationId, executionId, {
      status: 'canceled',
      completed_at: new Date(),
    });

    return c.json(updated);
  } catch (error) {
    console.error('Cancel execution error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to cancel execution' }, 500);
  }
});

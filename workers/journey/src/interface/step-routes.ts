import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findJourneyById } from '../infrastructure/repositories/journey-repository.js';
import {
  createConnection,
  createStep,
  deleteConnection,
  deleteConnectionsByStepId,
  deleteStep,
  findStepById,
  updateStep,
} from '../infrastructure/repositories/step-repository.js';
import { findLatestVersion } from '../infrastructure/repositories/version-repository.js';

export const stepRoutes = new Hono<Env>();

// POST /api/v1/journey/journeys/:id/steps - Add step to journey's latest draft version
stepRoutes.post('/api/v1/journey/journeys/:id/steps', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    if (journey.status !== 'draft') {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Steps can only be added to draft journeys',
        },
        400,
      );
    }

    const latestVersion = await findLatestVersion(
      db,
      tenant.organizationId,
      journeyId,
    );
    if (!latestVersion) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message:
            'No version exists for this journey. Publish first to create a version.',
        },
        400,
      );
    }

    const body = await c.req.json<{
      type: string;
      config: Record<string, unknown>;
      positionX: number;
      positionY: number;
    }>();

    if (!body.type || !body.config) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'type and config are required' },
        400,
      );
    }

    const step = await createStep(db, tenant.organizationId, {
      journey_version_id: latestVersion.id,
      type: body.type,
      config: body.config,
      position_x: body.positionX ?? 0,
      position_y: body.positionY ?? 0,
    });

    return c.json(step, 201);
  } catch (error) {
    console.error('Create step error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create step' },
      500,
    );
  }
});

// PATCH /api/v1/journey/steps/:stepId - Update step
stepRoutes.patch('/api/v1/journey/steps/:stepId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stepId = c.req.param('stepId');

  try {
    const body = await c.req.json<{
      config?: Record<string, unknown>;
      positionX?: number;
      positionY?: number;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.config !== undefined) updateData.config = body.config;
    if (body.positionX !== undefined) updateData.position_x = body.positionX;
    if (body.positionY !== undefined) updateData.position_y = body.positionY;

    const step = await updateStep(
      db,
      tenant.organizationId,
      stepId,
      updateData,
    );
    if (!step) {
      return c.json({ code: 'NOT_FOUND', message: 'Step not found' }, 404);
    }

    return c.json(step);
  } catch (error) {
    console.error('Update step error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update step' },
      500,
    );
  }
});

// DELETE /api/v1/journey/steps/:stepId - Delete step
stepRoutes.delete('/api/v1/journey/steps/:stepId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stepId = c.req.param('stepId');

  try {
    // Delete associated connections first
    await deleteConnectionsByStepId(db, stepId);

    const deleted = await deleteStep(db, tenant.organizationId, stepId);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Step not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete step error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete step' },
      500,
    );
  }
});

// POST /api/v1/journey/journeys/:id/connections - Add connection between steps
stepRoutes.post('/api/v1/journey/journeys/:id/connections', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const body = await c.req.json<{
      fromStepId: string;
      toStepId: string;
      label?: string;
    }>();

    if (!body.fromStepId || !body.toStepId) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'fromStepId and toStepId are required',
        },
        400,
      );
    }

    // Verify both steps exist and belong to this org
    const fromStep = await findStepById(
      db,
      tenant.organizationId,
      body.fromStepId,
    );
    const toStep = await findStepById(db, tenant.organizationId, body.toStepId);

    if (!fromStep || !toStep) {
      return c.json(
        { code: 'NOT_FOUND', message: 'One or both steps not found' },
        404,
      );
    }

    const connection = await createConnection(db, {
      from_step_id: body.fromStepId,
      to_step_id: body.toStepId,
      label: body.label ?? null,
    });

    return c.json(connection, 201);
  } catch (error) {
    console.error('Create connection error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create connection' },
      500,
    );
  }
});

// DELETE /api/v1/journey/connections/:connectionId - Remove connection
stepRoutes.delete('/api/v1/journey/connections/:connectionId', async (c) => {
  const db = c.get('db');
  const connectionId = c.req.param('connectionId');

  try {
    const deleted = await deleteConnection(db, connectionId);
    if (!deleted) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Connection not found' },
        404,
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete connection' },
      500,
    );
  }
});

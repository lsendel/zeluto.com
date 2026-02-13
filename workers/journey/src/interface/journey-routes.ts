import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findJourneyById,
  findAllJourneys,
  createJourney,
  updateJourney,
  deleteJourney,
} from '../infrastructure/repositories/journey-repository.js';
import {
  findLatestVersion,
  getNextVersionNumber,
  createVersion,
} from '../infrastructure/repositories/version-repository.js';
import {
  findStepsByVersionId,
  findConnectionsByStepIds,
} from '../infrastructure/repositories/step-repository.js';
import {
  findTriggersByJourneyId,
} from '../infrastructure/repositories/trigger-repository.js';

export const journeyRoutes = new Hono<Env>();

// GET /api/v1/journey/journeys - List journeys (paginated)
journeyRoutes.get('/api/v1/journey/journeys', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search, status } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllJourneys(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      search: search || undefined,
      status: status || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List journeys error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list journeys' }, 500);
  }
});

// POST /api/v1/journey/journeys - Create journey
journeyRoutes.post('/api/v1/journey/journeys', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
    }>();

    if (!body.name) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'name is required' }, 400);
    }

    const journey = await createJourney(db, tenant.organizationId, {
      name: body.name,
      description: body.description ?? null,
      status: 'draft',
      created_by: tenant.userId,
    });

    return c.json(journey, 201);
  } catch (error) {
    console.error('Create journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create journey' }, 500);
  }
});

// GET /api/v1/journey/journeys/:id - Get journey with latest version
journeyRoutes.get('/api/v1/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, id);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const latestVersion = await findLatestVersion(db, tenant.organizationId, id);
    const triggers = await findTriggersByJourneyId(db, tenant.organizationId, id);

    let steps: unknown[] = [];
    let connections: unknown[] = [];
    if (latestVersion) {
      steps = await findStepsByVersionId(db, tenant.organizationId, latestVersion.id);
      const stepIds = steps.map((s: any) => s.id);
      connections = await findConnectionsByStepIds(db, stepIds);
    }

    return c.json({
      ...journey,
      latestVersion: latestVersion
        ? { ...latestVersion, steps, connections }
        : null,
      triggers,
    });
  } catch (error) {
    console.error('Get journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get journey' }, 500);
  }
});

// PATCH /api/v1/journey/journeys/:id - Update journey
journeyRoutes.patch('/api/v1/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      description?: string | null;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;

    const journey = await updateJourney(db, tenant.organizationId, id, updateData);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    return c.json(journey);
  } catch (error) {
    console.error('Update journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update journey' }, 500);
  }
});

// DELETE /api/v1/journey/journeys/:id - Delete journey
journeyRoutes.delete('/api/v1/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteJourney(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete journey' }, 500);
  }
});

// POST /api/v1/journey/journeys/:id/publish - Publish journey
journeyRoutes.post('/api/v1/journey/journeys/:id/publish', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, id);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    if (journey.status !== 'draft' && journey.status !== 'paused') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Only draft or paused journeys can be published' },
        400,
      );
    }

    // Create a new version snapshot
    const latestVersion = await findLatestVersion(db, tenant.organizationId, id);
    const nextVersionNum = await getNextVersionNumber(db, tenant.organizationId, id);

    // Build the definition from existing steps or use the latest version's definition
    let definition: Record<string, unknown> = {};
    if (latestVersion) {
      const steps = await findStepsByVersionId(db, tenant.organizationId, latestVersion.id);
      const stepIds = steps.map((s) => s.id);
      const connections = await findConnectionsByStepIds(db, stepIds);
      definition = { steps, connections };
    }

    const newVersion = await createVersion(db, tenant.organizationId, {
      journey_id: id,
      version_number: nextVersionNum,
      definition,
      published_at: new Date(),
    });

    // Activate the journey
    const updated = await updateJourney(db, tenant.organizationId, id, {
      status: 'active',
    });

    return c.json({
      ...updated,
      publishedVersion: newVersion,
    });
  } catch (error) {
    console.error('Publish journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to publish journey' }, 500);
  }
});

// POST /api/v1/journey/journeys/:id/pause - Pause journey
journeyRoutes.post('/api/v1/journey/journeys/:id/pause', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, id);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    if (journey.status !== 'active') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Only active journeys can be paused' },
        400,
      );
    }

    const updated = await updateJourney(db, tenant.organizationId, id, {
      status: 'paused',
    });

    return c.json(updated);
  } catch (error) {
    console.error('Pause journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to pause journey' }, 500);
  }
});

// POST /api/v1/journey/journeys/:id/resume - Resume journey
journeyRoutes.post('/api/v1/journey/journeys/:id/resume', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, id);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    if (journey.status !== 'paused') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Only paused journeys can be resumed' },
        400,
      );
    }

    const updated = await updateJourney(db, tenant.organizationId, id, {
      status: 'active',
    });

    return c.json(updated);
  } catch (error) {
    console.error('Resume journey error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to resume journey' }, 500);
  }
});

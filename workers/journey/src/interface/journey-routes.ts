import { asJourneyId } from '@mauntic/domain-kernel';
import type { JourneyStatus } from '@mauntic/journey-domain';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { JourneyService } from '../application/journey-service.js';
import { DrizzleJourneyRepository } from '../infrastructure/repositories/drizzle-journey-repository.js';
import { DrizzleJourneyTriggerRepository } from '../infrastructure/repositories/drizzle-trigger-repository.js';
import { DrizzleJourneyVersionRepository } from '../infrastructure/repositories/drizzle-version-repository.js';
import {
  findConnectionsByStepIds,
  findStepsByVersionId,
} from '../infrastructure/repositories/step-repository.js';

function getService(db: NeonHttpDatabase) {
  const journeyRepo = new DrizzleJourneyRepository(db);
  const versionRepo = new DrizzleJourneyVersionRepository(db);
  const triggerRepo = new DrizzleJourneyTriggerRepository(db);
  return {
    service: new JourneyService(journeyRepo, versionRepo, triggerRepo),
    versionRepo,
    triggerRepo,
  };
}

export const journeyRoutes = new Hono<Env>();

// GET /api/v1/journey/journeys - List journeys (paginated)
journeyRoutes.get('/api/v1/journey/journeys', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search, status } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const { service } = getService(db);
    const result = await service.list(tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      search: search || undefined,
      status: (status as JourneyStatus) || undefined,
    });

    return c.json({
      data: result.data.map((j) => j.toProps()),
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List journeys error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list journeys' },
      500,
    );
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
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'name is required' },
        400,
      );
    }

    const { service } = getService(db);
    const result = await service.create({
      organizationId: tenant.organizationId,
      name: body.name,
      description: body.description ?? null,
      createdBy: tenant.userId,
    });

    if (result.isFailure) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: result.getError() },
        400,
      );
    }

    return c.json(result.getValue().toProps(), 201);
  } catch (error) {
    console.error('Create journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create journey' },
      500,
    );
  }
});

// GET /api/v1/journey/journeys/:id - Get journey with latest version
journeyRoutes.get('/api/v1/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = asJourneyId(c.req.param('id'));

  try {
    const { service, versionRepo, triggerRepo } = getService(db);
    const journey = await service.getById(tenant.organizationId, id);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const [latestVersion, triggers] = await Promise.all([
      versionRepo.findLatestByJourney(tenant.organizationId, id),
      triggerRepo.findByJourney(tenant.organizationId, id),
    ]);

    let steps: unknown[] = [];
    let connections: unknown[] = [];
    if (latestVersion) {
      steps = await findStepsByVersionId(
        db,
        tenant.organizationId,
        latestVersion.versionId,
      );
      const stepIds = (steps as any[]).map((s) => s.id);
      connections = await findConnectionsByStepIds(db, stepIds);
    }

    return c.json({
      ...journey.toProps(),
      latestVersion: latestVersion
        ? { ...latestVersion.toProps(), steps, connections }
        : null,
      triggers: triggers.map((t) => t.toProps()),
    });
  } catch (error) {
    console.error('Get journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get journey' },
      500,
    );
  }
});

// PATCH /api/v1/journey/journeys/:id - Update journey
journeyRoutes.patch('/api/v1/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = asJourneyId(c.req.param('id'));

  try {
    const body = await c.req.json<{
      name?: string;
      description?: string | null;
    }>();

    const { service } = getService(db);
    const result = await service.update(tenant.organizationId, id, body);
    if (result.isFailure) {
      const error = result.getError();
      if (error === 'Journey not found') {
        return c.json({ code: 'NOT_FOUND', message: error }, 404);
      }
      return c.json({ code: 'VALIDATION_ERROR', message: error }, 400);
    }

    return c.json(result.getValue().toProps());
  } catch (error) {
    console.error('Update journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update journey' },
      500,
    );
  }
});

// DELETE /api/v1/journey/journeys/:id - Delete journey
journeyRoutes.delete('/api/v1/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = asJourneyId(c.req.param('id'));

  try {
    const { service } = getService(db);
    const result = await service.remove(tenant.organizationId, id);
    if (result.isFailure) {
      return c.json({ code: 'NOT_FOUND', message: result.getError() }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete journey' },
      500,
    );
  }
});

// POST /api/v1/journey/journeys/:id/publish - Publish journey
journeyRoutes.post('/api/v1/journey/journeys/:id/publish', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = asJourneyId(c.req.param('id'));

  try {
    const { service, versionRepo } = getService(db);

    // Build the definition from the latest version's steps
    const latestVersion = await versionRepo.findLatestByJourney(
      tenant.organizationId,
      id,
    );

    let definition: Record<string, unknown> = {};
    if (latestVersion) {
      const steps = await findStepsByVersionId(
        db,
        tenant.organizationId,
        latestVersion.versionId,
      );
      const stepIds = steps.map((s) => s.id);
      const connections = await findConnectionsByStepIds(db, stepIds);
      definition = { steps, connections };
    }

    const result = await service.publish(tenant.organizationId, id, definition);

    if (result.isFailure) {
      const error = result.getError();
      if (error === 'Journey not found') {
        return c.json({ code: 'NOT_FOUND', message: error }, 404);
      }
      return c.json({ code: 'VALIDATION_ERROR', message: error }, 400);
    }

    const { journey, version } = result.getValue();
    return c.json({
      ...journey.toProps(),
      publishedVersion: version.toProps(),
    });
  } catch (error) {
    console.error('Publish journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to publish journey' },
      500,
    );
  }
});

// POST /api/v1/journey/journeys/:id/pause - Pause journey
journeyRoutes.post('/api/v1/journey/journeys/:id/pause', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = asJourneyId(c.req.param('id'));

  try {
    const { service } = getService(db);
    const result = await service.pause(tenant.organizationId, id);
    if (result.isFailure) {
      const error = result.getError();
      if (error === 'Journey not found') {
        return c.json({ code: 'NOT_FOUND', message: error }, 404);
      }
      return c.json({ code: 'VALIDATION_ERROR', message: error }, 400);
    }

    return c.json(result.getValue().toProps());
  } catch (error) {
    console.error('Pause journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to pause journey' },
      500,
    );
  }
});

// POST /api/v1/journey/journeys/:id/resume - Resume journey
journeyRoutes.post('/api/v1/journey/journeys/:id/resume', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = asJourneyId(c.req.param('id'));

  try {
    const { service } = getService(db);
    const result = await service.resume(tenant.organizationId, id);
    if (result.isFailure) {
      const error = result.getError();
      if (error === 'Journey not found') {
        return c.json({ code: 'NOT_FOUND', message: error }, 404);
      }
      return c.json({ code: 'VALIDATION_ERROR', message: error }, 400);
    }

    return c.json(result.getValue().toProps());
  } catch (error) {
    console.error('Resume journey error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to resume journey' },
      500,
    );
  }
});

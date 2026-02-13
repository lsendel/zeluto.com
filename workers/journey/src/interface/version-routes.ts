import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findVersionById,
  findVersionsByJourneyId,
} from '../infrastructure/repositories/version-repository.js';
import {
  findStepsByVersionId,
  findConnectionsByStepIds,
} from '../infrastructure/repositories/step-repository.js';
import {
  findJourneyById,
} from '../infrastructure/repositories/journey-repository.js';

export const versionRoutes = new Hono<Env>();

// GET /api/v1/journey/journeys/:id/versions - List versions for a journey
versionRoutes.get('/api/v1/journey/journeys/:id/versions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, journeyId);
    if (!journey) {
      return c.json({ code: 'NOT_FOUND', message: 'Journey not found' }, 404);
    }

    const versions = await findVersionsByJourneyId(db, tenant.organizationId, journeyId);
    return c.json(versions);
  } catch (error) {
    console.error('List versions error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list versions' }, 500);
  }
});

// GET /api/v1/journey/versions/:versionId - Get version with steps
versionRoutes.get('/api/v1/journey/versions/:versionId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const versionId = c.req.param('versionId');

  try {
    const version = await findVersionById(db, tenant.organizationId, versionId);
    if (!version) {
      return c.json({ code: 'NOT_FOUND', message: 'Version not found' }, 404);
    }

    const steps = await findStepsByVersionId(db, tenant.organizationId, versionId);
    const stepIds = steps.map((s) => s.id);
    const connections = await findConnectionsByStepIds(db, stepIds);

    return c.json({
      ...version,
      steps,
      connections,
    });
  } catch (error) {
    console.error('Get version error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get version' }, 500);
  }
});

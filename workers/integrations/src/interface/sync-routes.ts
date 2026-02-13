import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findConnectionById } from '../infrastructure/repositories/connection-repository.js';
import {
  findSyncJobById,
  findSyncJobsByConnection,
  createSyncJob,
} from '../infrastructure/repositories/sync-job-repository.js';

export const syncRoutes = new Hono<Env>();

// POST /api/v1/integrations/connections/:id/sync - Trigger sync
syncRoutes.post('/api/v1/integrations/connections/:id/sync', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const connectionId = c.req.param('id');

  try {
    // Verify connection exists
    const connection = await findConnectionById(db, tenant.organizationId, connectionId);
    if (!connection) {
      return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
    }

    if (connection.status !== 'active') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: `Connection is ${connection.status}, cannot sync` },
        400,
      );
    }

    // Parse optional body
    let direction = 'inbound';
    let entityType = 'contacts';
    try {
      const body = await c.req.json<{
        direction?: string;
        entityType?: string;
      }>();
      if (body.direction) direction = body.direction;
      if (body.entityType) entityType = body.entityType;
    } catch {
      // Default values are fine
    }

    // Create sync job
    const syncJob = await createSyncJob(db, tenant.organizationId, {
      connectionId,
      direction,
      entityType,
      status: 'pending',
    });

    // In production, this would also enqueue a BullMQ job for the sync worker
    return c.json(syncJob, 202);
  } catch (error) {
    console.error('Trigger sync error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to trigger sync' }, 500);
  }
});

// GET /api/v1/integrations/connections/:id/sync-jobs - List sync jobs for connection
syncRoutes.get('/api/v1/integrations/connections/:id/sync-jobs', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const connectionId = c.req.param('id');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    // Verify connection exists
    const connection = await findConnectionById(db, tenant.organizationId, connectionId);
    if (!connection) {
      return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
    }

    const result = await findSyncJobsByConnection(db, tenant.organizationId, connectionId, {
      page: pageNum,
      limit: limitNum,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List sync jobs error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list sync jobs' }, 500);
  }
});

// GET /api/v1/integrations/sync-jobs/:id - Get sync job by ID
syncRoutes.get('/api/v1/integrations/sync-jobs/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const syncJob = await findSyncJobById(db, tenant.organizationId, id);
    if (!syncJob) {
      return c.json({ code: 'NOT_FOUND', message: 'Sync job not found' }, 404);
    }
    return c.json(syncJob);
  } catch (error) {
    console.error('Get sync job error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get sync job' }, 500);
  }
});

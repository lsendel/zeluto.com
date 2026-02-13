import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findConnectionById,
  findAllConnections,
  createConnection,
  updateConnection,
  deleteConnection,
} from '../infrastructure/repositories/connection-repository.js';

export const connectionRoutes = new Hono<Env>();

// GET /api/v1/integrations/connections - List connections
connectionRoutes.get('/api/v1/integrations/connections', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllConnections(db, tenant.organizationId, {
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
    console.error('List connections error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list connections' }, 500);
  }
});

// POST /api/v1/integrations/connections - Create connection
connectionRoutes.post('/api/v1/integrations/connections', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      provider: string;
      name: string;
      config: Record<string, unknown>;
    }>();

    if (!body.provider || !body.name) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'provider and name are required' },
        400,
      );
    }

    const connection = await createConnection(db, tenant.organizationId, {
      provider: body.provider,
      name: body.name,
      config: body.config ?? {},
    });

    return c.json(connection, 201);
  } catch (error) {
    console.error('Create connection error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create connection' }, 500);
  }
});

// GET /api/v1/integrations/connections/:id - Get connection by ID
connectionRoutes.get('/api/v1/integrations/connections/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const connection = await findConnectionById(db, tenant.organizationId, id);
    if (!connection) {
      return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
    }
    return c.json(connection);
  } catch (error) {
    console.error('Get connection error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get connection' }, 500);
  }
});

// PATCH /api/v1/integrations/connections/:id - Update connection
connectionRoutes.patch('/api/v1/integrations/connections/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      config?: Record<string, unknown>;
      status?: string;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.status !== undefined) updateData.status = body.status;

    const connection = await updateConnection(db, tenant.organizationId, id, updateData);
    if (!connection) {
      return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
    }

    return c.json(connection);
  } catch (error) {
    console.error('Update connection error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update connection' }, 500);
  }
});

// DELETE /api/v1/integrations/connections/:id - Delete connection
connectionRoutes.delete('/api/v1/integrations/connections/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteConnection(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete connection' }, 500);
  }
});

// POST /api/v1/integrations/connections/:id/test - Test connection
connectionRoutes.post('/api/v1/integrations/connections/:id/test', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const connection = await findConnectionById(db, tenant.organizationId, id);
    if (!connection) {
      return c.json({ code: 'NOT_FOUND', message: 'Connection not found' }, 404);
    }

    // Test connectivity based on provider type
    // This is a simplified test - actual provider-specific tests would be called here
    return c.json({
      success: true,
      message: `Connection to ${connection.provider} is configured`,
    });
  } catch (error) {
    console.error('Test connection error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to test connection' }, 500);
  }
});

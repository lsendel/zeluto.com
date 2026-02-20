import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createWorkflow,
  findWorkflowsByOrganization,
} from '../infrastructure/repositories/workflow-repository.js';

export const workflowRoutes = new Hono<Env>();

workflowRoutes.get('/api/v1/revops/workflows', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const wfs = await findWorkflowsByOrganization(db, tenant.organizationId);
    return c.json(wfs);
  } catch (error) {
    console.error('List workflows error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list workflows' },
      500,
    );
  }
});

workflowRoutes.post('/api/v1/revops/workflows', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const wf = await createWorkflow(db, tenant.organizationId, body);
    return c.json(wf, 201);
  } catch (error) {
    console.error('Create workflow error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create workflow' },
      500,
    );
  }
});

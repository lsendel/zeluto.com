import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createJob,
  findInsightsByContact,
} from '../infrastructure/repositories/research-repository.js';

export const researchRoutes = new Hono<Env>();

researchRoutes.post('/api/v1/revops/research', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{ contactId: string; type: string }>();

    const job = await createJob(db, tenant.organizationId, {
      contact_id: body.contactId,
      type: body.type,
      status: 'pending',
    });

    await c.env.EVENTS.send({
      type: 'revops.ResearchJobCreated',
      data: {
        jobId: job.id,
        organizationId: tenant.organizationId,
        contactId: body.contactId,
        type: body.type,
      },
    });

    return c.json({ jobId: job.id, message: 'Research job queued' }, 202);
  } catch (error) {
    console.error('Create research job error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create research job' },
      500,
    );
  }
});

researchRoutes.get('/api/v1/revops/contacts/:contactId/insights', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { contactId } = c.req.param();

  try {
    const insights = await findInsightsByContact(
      db,
      tenant.organizationId,
      contactId,
    );
    return c.json(insights);
  } catch (error) {
    console.error('Get insights error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get insights' },
      500,
    );
  }
});

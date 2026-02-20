import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createJob,
  findJobsByContact,
} from '../infrastructure/repositories/enrichment-job-repository.js';

export const enrichmentRoutes = new Hono<Env>();

// POST /api/v1/lead-intelligence/contacts/:contactId/enrich
enrichmentRoutes.post(
  '/api/v1/lead-intelligence/contacts/:contactId/enrich',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const contactId = c.req.param('contactId');

    try {
      const body = await c.req.json<{ fields?: string[]; priority?: string }>();

      const job = await createJob(db, {
        organization_id: tenant.organizationId,
        contact_id: contactId,
        status: 'pending',
        field_requests: body.fields ?? ['email', 'phone', 'company', 'title'],
        results: null,
        providers_tried: null,
        error: null,
        started_at: null,
        completed_at: null,
      });

      // Queue job for async processing
      await c.env.EVENTS.send({
        type: 'enrichment.JobCreated',
        data: {
          jobId: job.id,
          organizationId: tenant.organizationId,
          contactId,
          priority: body.priority ?? 'normal',
        },
      });

      return c.json(job, 202);
    } catch (error) {
      console.error('Enrich contact error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to enrich contact' },
        500,
      );
    }
  },
);

// POST /api/v1/lead-intelligence/contacts/enrich/batch
enrichmentRoutes.post(
  '/api/v1/lead-intelligence/contacts/enrich/batch',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');

    try {
      const body = await c.req.json<{
        contactIds: string[];
        fields?: string[];
      }>();

      if (!body.contactIds?.length || body.contactIds.length > 100) {
        return c.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'contactIds must have 1-100 entries',
          },
          400,
        );
      }

      const jobIds: string[] = [];
      for (const contactId of body.contactIds) {
        const job = await createJob(db, {
          organization_id: tenant.organizationId,
          contact_id: contactId,
          status: 'pending',
          field_requests: body.fields ?? ['email', 'phone', 'company', 'title'],
          results: null,
          providers_tried: null,
          error: null,
          started_at: null,
          completed_at: null,
        });
        jobIds.push(job.id);
      }

      await c.env.EVENTS.send({
        type: 'enrichment.BatchCreated',
        data: { jobIds, organizationId: tenant.organizationId },
      });

      return c.json({ jobIds }, 202);
    } catch (error) {
      console.error('Batch enrich error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create batch enrichment',
        },
        500,
      );
    }
  },
);

// GET /api/v1/lead-intelligence/contacts/:contactId/enrichment-history
enrichmentRoutes.get(
  '/api/v1/lead-intelligence/contacts/:contactId/enrichment-history',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const contactId = c.req.param('contactId');
    const { page = '1', limit = '20' } = c.req.query();

    try {
      const result = await findJobsByContact(
        db,
        tenant.organizationId,
        contactId,
        {
          page: Math.max(1, parseInt(page, 10) || 1),
          limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
        },
      );

      return c.json({ items: result.data, total: result.total });
    } catch (error) {
      console.error('Get enrichment history error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to get enrichment history' },
        500,
      );
    }
  },
);

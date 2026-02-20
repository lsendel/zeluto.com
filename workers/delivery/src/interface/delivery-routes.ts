import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findEventsByJobId } from '../infrastructure/repositories/delivery-event-repository.js';
import {
  createJob,
  findAllJobs,
  findJobById,
  findJobByIdempotencyKey,
} from '../infrastructure/repositories/delivery-job-repository.js';

export const deliveryRoutes = new Hono<Env>();

// POST /api/v1/delivery/send - Send a single message
deliveryRoutes.post('/api/v1/delivery/send', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      channel: string;
      to: string;
      subject?: string;
      body: string;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string;
    }>();

    if (!body.channel || !body.to || !body.body) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'channel, to, and body are required',
        },
        400,
      );
    }

    const validChannels = ['email', 'sms', 'push', 'webhook'];
    if (!validChannels.includes(body.channel)) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: `channel must be one of: ${validChannels.join(', ')}`,
        },
        400,
      );
    }

    const idempotencyKey = body.idempotencyKey ?? crypto.randomUUID();

    // Check idempotency
    const existing = await findJobByIdempotencyKey(
      db,
      tenant.organizationId,
      idempotencyKey,
    );
    if (existing) {
      return c.json(existing, 201);
    }

    const job = await createJob(db, tenant.organizationId, {
      channel: body.channel,
      status: 'queued',
      recipient_count: 1,
      sent_count: 0,
      failed_count: 0,
      idempotency_key: idempotencyKey,
      metadata: {
        to: body.to,
        subject: body.subject,
        body: body.body,
        ...body.metadata,
      },
    });

    // Enqueue to delivery engine via Queue binding
    try {
      await c.env.EVENTS.send({
        type: 'delivery.SendMessage',
        data: {
          organizationId: tenant.organizationId,
          deliveryJobId: job.id,
          channel: body.channel,
          to: body.to,
          subject: body.subject,
          body: body.body,
        },
      });
    } catch (err) {
      console.error('Failed to enqueue delivery message:', err);
    }

    return c.json(job, 201);
  } catch (error) {
    console.error('Send message error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to send message' },
      500,
    );
  }
});

// POST /api/v1/delivery/send/batch - Send batch messages
deliveryRoutes.post('/api/v1/delivery/send/batch', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      channel: string;
      messages: Array<{
        to: string;
        subject?: string;
        body: string;
        metadata?: Record<string, unknown>;
      }>;
      idempotencyKey?: string;
    }>();

    if (
      !body.channel ||
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'channel and messages array are required',
        },
        400,
      );
    }

    const idempotencyKey = body.idempotencyKey ?? crypto.randomUUID();

    // Check idempotency
    const existing = await findJobByIdempotencyKey(
      db,
      tenant.organizationId,
      idempotencyKey,
    );
    if (existing) {
      return c.json(existing, 201);
    }

    const job = await createJob(db, tenant.organizationId, {
      channel: body.channel,
      status: 'queued',
      recipient_count: body.messages.length,
      sent_count: 0,
      failed_count: 0,
      idempotency_key: idempotencyKey,
      metadata: { messages: body.messages },
    });

    // Enqueue each message
    try {
      for (const msg of body.messages) {
        await c.env.EVENTS.send({
          type: 'delivery.SendMessage',
          data: {
            organizationId: tenant.organizationId,
            deliveryJobId: job.id,
            channel: body.channel,
            to: msg.to,
            subject: msg.subject,
            body: msg.body,
          },
        });
      }
    } catch (err) {
      console.error('Failed to enqueue batch messages:', err);
    }

    return c.json(job, 201);
  } catch (error) {
    console.error('Send batch error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to send batch' },
      500,
    );
  }
});

// GET /api/v1/delivery/jobs - List delivery jobs
deliveryRoutes.get('/api/v1/delivery/jobs', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', channel, status } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllJobs(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      channel: channel || undefined,
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
    console.error('List jobs error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list jobs' },
      500,
    );
  }
});

// GET /api/v1/delivery/jobs/:id - Get job by ID
deliveryRoutes.get('/api/v1/delivery/jobs/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const job = await findJobById(db, tenant.organizationId, id);
    if (!job) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Delivery job not found' },
        404,
      );
    }
    return c.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get job' },
      500,
    );
  }
});

// GET /api/v1/delivery/jobs/:id/events - Get events for a job
deliveryRoutes.get('/api/v1/delivery/jobs/:id/events', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    // Verify job exists
    const job = await findJobById(db, tenant.organizationId, id);
    if (!job) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Delivery job not found' },
        404,
      );
    }

    const result = await findEventsByJobId(db, tenant.organizationId, id, {
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
    console.error('Get job events error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get job events' },
      500,
    );
  }
});

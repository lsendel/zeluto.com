import { Hono } from 'hono';
import type { Env } from '../app.js';
import { buildContactTimelineReadModel } from '../application/contact-timeline-read-model.js';
import {
  logEvent,
  queryAggregates,
  queryEvents,
} from '../infrastructure/repositories/event-repository.js';

export const eventRoutes = new Hono<Env>();

// POST /api/v1/analytics/events - Log an analytics event
eventRoutes.post('/api/v1/analytics/events', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      contactId: string;
      eventType: string;
      eventSource?: string;
      eventData?: Record<string, unknown>;
    }>();

    if (!body.contactId || !body.eventType) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'contactId and eventType are required',
        },
        400,
      );
    }

    const event = await logEvent(db, tenant.organizationId, {
      contactId: body.contactId,
      eventType: body.eventType,
      eventSource: body.eventSource,
      eventData: body.eventData,
    });

    return c.json(event, 201);
  } catch (error) {
    console.error('Log event error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to log event' },
      500,
    );
  }
});

// GET /api/v1/analytics/events - Query events (paginated)
eventRoutes.get('/api/v1/analytics/events', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const {
    page = '1',
    limit = '25',
    eventType,
    contactId,
    startDate,
    endDate,
  } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await queryEvents(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      eventType: eventType || undefined,
      contactId: contactId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('Query events error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to query events' },
      500,
    );
  }
});

// GET /api/v1/analytics/events/aggregates - Query aggregated event data
eventRoutes.get('/api/v1/analytics/events/aggregates', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { startDate, endDate, eventType } = c.req.query();

  try {
    const aggregates = await queryAggregates(db, tenant.organizationId, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      eventType: eventType || undefined,
    });

    return c.json({ data: aggregates });
  } catch (error) {
    console.error('Query aggregates error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to query aggregates' },
      500,
    );
  }
});

// GET /api/v1/analytics/contacts/:id/activity - Contact activity feed
eventRoutes.get('/api/v1/analytics/contacts/:id/activity', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.param('id');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await queryEvents(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      contactId,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('Contact activity error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get contact activity' },
      500,
    );
  }
});

// GET /api/v1/analytics/contacts/:id/timeline - Consolidated timeline
eventRoutes.get('/api/v1/analytics/contacts/:id/timeline', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.param('id');
  const { page = '1', limit = '50', startDate, endDate } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  try {
    const result = await queryEvents(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      contactId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return c.json(
      buildContactTimelineReadModel(result.data, {
        page: pageNum,
        limit: limitNum,
        total: result.total,
      }),
    );
  } catch (error) {
    console.error('Contact timeline error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get contact timeline' },
      500,
    );
  }
});

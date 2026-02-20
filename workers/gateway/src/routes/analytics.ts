import { Hono } from 'hono';
import type { Env } from '../index.js';
import { dispatchRequest, type ServiceBinding } from '../lib/dispatch.js';
import { forwardToService } from '../lib/forward.js';
import { parseJsonBody } from '../lib/parse-payload.js';

export function createAnalyticsRoutes() {
  const app = new Hono<Env>();

  function analyticsBinding(c: any): ServiceBinding {
    return {
      dispatch: c.env.ANALYTICS_DISPATCH,
      http: c.env.ANALYTICS,
      serviceName: 'analytics',
    };
  }

  // --- Overview ---

  app.get('/overview', async (c) => {
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'overview', {})) ??
      forwardToService(c, c.env.ANALYTICS)
    );
  });

  // --- Campaign / Journey Performance ---

  app.get('/campaigns/:campaignId/performance', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'campaigns/performance', {
        campaignId: c.req.param('campaignId'),
        startDate: searchParams.get('startDate') ?? undefined,
        endDate: searchParams.get('endDate') ?? undefined,
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.get('/journeys/:journeyId/performance', async (c) => {
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'journeys/performance', {
        journeyId: c.req.param('journeyId'),
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  // --- Events ---

  app.get('/events', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'events/list', {
        page: Number.isNaN(page) ? undefined : page,
        limit: Number.isNaN(limit) ? undefined : limit,
        eventType: searchParams.get('eventType') ?? undefined,
        contactId: searchParams.get('contactId') ?? undefined,
        startDate: searchParams.get('startDate') ?? undefined,
        endDate: searchParams.get('endDate') ?? undefined,
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.get('/events/aggregates', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'events/aggregates', {
        startDate: searchParams.get('startDate') ?? undefined,
        endDate: searchParams.get('endDate') ?? undefined,
        eventType: searchParams.get('eventType') ?? undefined,
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.get('/contacts/:contactId/activity', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'events/activity', {
        contactId: c.req.param('contactId'),
        page: Number.isNaN(page) ? undefined : page,
        limit: Number.isNaN(limit) ? undefined : limit,
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.post('/events', async (c) => {
    const payload = await parseJsonBody(c);
    return (
      (await dispatchRequest(
        c,
        analyticsBinding(c),
        'events/log',
        payload ?? {},
      )) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  // --- Reports ---

  app.get('/reports', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'reports/list', {
        page: Number.isNaN(page) ? undefined : page,
        limit: Number.isNaN(limit) ? undefined : limit,
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.get('/reports/:reportId', async (c) => {
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'reports/get', {
        id: c.req.param('reportId'),
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.post('/reports', async (c) => {
    const payload = await parseJsonBody(c);
    return (
      (await dispatchRequest(
        c,
        analyticsBinding(c),
        'reports/create',
        payload ?? {},
      )) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.patch('/reports/:reportId', async (c) => {
    const payload = await parseJsonBody(c);
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'reports/update', {
        id: c.req.param('reportId'),
        ...(payload ?? {}),
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.delete('/reports/:reportId', async (c) => {
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'reports/delete', {
        id: c.req.param('reportId'),
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  app.post('/reports/:reportId/run', async (c) => {
    const payload = await parseJsonBody(c);
    return (
      (await dispatchRequest(c, analyticsBinding(c), 'reports/run', {
        id: c.req.param('reportId'),
        ...(payload ?? {}),
      })) ?? forwardToService(c, c.env.ANALYTICS)
    );
  });

  // Catch-all
  app.all('/*', async (c) => {
    return forwardToService(c, c.env.ANALYTICS);
  });

  return app;
}

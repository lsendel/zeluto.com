import { Hono } from 'hono';
import type { Env } from '../index.js';
import { dispatchRequest, type ServiceBinding } from '../lib/dispatch.js';
import { forwardToService } from '../lib/forward.js';
import { parsePayload } from '../lib/parse-payload.js';

export function createDeliveryRoutes() {
  const app = new Hono<Env>();

  function deliveryBinding(c: any): ServiceBinding {
    return {
      dispatch: c.env.DELIVERY_DISPATCH,
      http: c.env.DELIVERY,
      serviceName: 'delivery',
    };
  }

  // --- Sending Domains ---

  app.get('/sending-domains', async (c) => {
    return (
      (await dispatchRequest(
        c,
        deliveryBinding(c),
        'sending-domains/list',
        {},
      )) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.post('/sending-domains', async (c) => {
    const payload = await parsePayload(c, ['domain']);
    return (
      (await dispatchRequest(
        c,
        deliveryBinding(c),
        'sending-domains/create',
        payload,
      )) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.post('/sending-domains/:domainId/verify', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'sending-domains/verify', {
        id: c.req.param('domainId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.get('/sending-domains/:domainId/dns-records', async (c) => {
    return (
      (await dispatchRequest(
        c,
        deliveryBinding(c),
        'sending-domains/dns-records',
        {
          id: c.req.param('domainId'),
        },
      )) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.delete('/sending-domains/:domainId', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'sending-domains/delete', {
        id: c.req.param('domainId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  // --- Jobs ---

  app.get('/jobs', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'jobs/list', {
        page,
        limit,
        channel: searchParams.get('channel') ?? undefined,
        status: searchParams.get('status') ?? undefined,
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.get('/jobs/:jobId', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'jobs/get', {
        id: c.req.param('jobId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.get('/jobs/:jobId/events', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'jobs/events', {
        id: c.req.param('jobId'),
        page,
        limit,
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  // --- Providers ---

  app.get('/providers', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'providers/list', {})) ??
      forwardToService(c, c.env.DELIVERY)
    );
  });

  app.get('/providers/:providerId', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'providers/get', {
        id: c.req.param('providerId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.post('/providers', async (c) => {
    const payload = await parseDeliveryProviderPayload(c);
    return (
      (await dispatchRequest(
        c,
        deliveryBinding(c),
        'providers/create',
        payload,
      )) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.patch('/providers/:providerId', async (c) => {
    const payload = await parseDeliveryProviderPayload(c);
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'providers/update', {
        id: c.req.param('providerId'),
        ...payload,
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.delete('/providers/:providerId', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'providers/delete', {
        id: c.req.param('providerId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.post('/providers/:providerId/test', async (c) => {
    const payload = await parsePayload(c, ['to', 'subject', 'body']);
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'providers/test', {
        id: c.req.param('providerId'),
        ...payload,
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  // --- Suppressions ---

  app.get('/suppressions', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'suppressions/list', {
        page: Number.isNaN(page) ? undefined : page,
        limit: Number.isNaN(limit) ? undefined : limit,
        reason: searchParams.get('reason') ?? undefined,
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.get('/suppressions/check', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'suppressions/check', {
        email: searchParams.get('email') ?? undefined,
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.post('/suppressions', async (c) => {
    const payload = await parsePayload(c, ['email', 'reason', 'source']);
    return (
      (await dispatchRequest(
        c,
        deliveryBinding(c),
        'suppressions/create',
        payload,
      )) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  app.delete('/suppressions/:suppressionId', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'suppressions/delete', {
        id: c.req.param('suppressionId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  // --- Warmup ---

  app.get('/warmup', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'warmup/list', {})) ??
      forwardToService(c, c.env.DELIVERY)
    );
  });

  app.get('/warmup/:domainId/progress', async (c) => {
    return (
      (await dispatchRequest(c, deliveryBinding(c), 'warmup/progress', {
        id: c.req.param('domainId'),
      })) ?? forwardToService(c, c.env.DELIVERY)
    );
  });

  // Catch-all for routes not explicitly handled
  app.all('/*', async (c) => {
    return forwardToService(c, c.env.DELIVERY);
  });

  return app;
}

/**
 * Provider payload has special handling: config is JSON-parsed, isActive is boolean,
 * priority is number. Doesn't fit the generic string-only parsePayload.
 */
async function parseDeliveryProviderPayload(
  c: any,
): Promise<Record<string, unknown>> {
  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return body ?? {};
  }

  const formData = await c.req.parseBody();
  const payload: Record<string, unknown> = {};
  if (typeof formData?.channel === 'string') payload.channel = formData.channel;
  if (typeof formData?.providerType === 'string')
    payload.providerType = formData.providerType;
  if (typeof formData?.config === 'string') {
    try {
      payload.config = JSON.parse(formData.config);
    } catch {
      payload.config = undefined;
    }
  }
  if (typeof formData?.isActive === 'string') {
    payload.isActive = formData.isActive === 'true';
  }
  if (typeof formData?.priority === 'string') {
    payload.priority = Number(formData.priority);
  }
  return payload;
}

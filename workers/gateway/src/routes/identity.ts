import { Hono } from 'hono';
import type { Env } from '../index.js';
import { dispatchRequest, type ServiceBinding } from '../lib/dispatch.js';
import { forwardToService } from '../lib/forward.js';
import { parsePayload } from '../lib/parse-payload.js';

export function createIdentityRoutes() {
  const app = new Hono<Env>();

  function identityBinding(c: any): ServiceBinding {
    return {
      dispatch: c.env.IDENTITY_DISPATCH,
      http: c.env.IDENTITY,
      serviceName: 'identity',
    };
  }

  // --- Users ---

  app.get('/users', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '20');
    const search = searchParams.get('search') ?? undefined;
    return await dispatchRequest(c, identityBinding(c), 'users/list', { page, limit, search })
      ?? forwardToService(c, c.env.IDENTITY);
  });

  app.get('/users/:userId', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'users/get', {
      userId: c.req.param('userId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.patch('/users/:userId/profile', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => null) as { name?: string; image?: string } | null;
    return await dispatchRequest(c, identityBinding(c), 'users/update-profile', {
      userId, name: body?.name, image: body?.image,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.patch('/users/:userId/role', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => null) as { role?: string } | null;
    return await dispatchRequest(c, identityBinding(c), 'users/update-role', {
      userId, role: body?.role,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/users/:userId/block', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'users/block', {
      userId: c.req.param('userId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/users/:userId/unblock', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'users/unblock', {
      userId: c.req.param('userId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  // --- Organizations ---

  app.get('/organizations', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '20');
    const search = searchParams.get('search') ?? undefined;
    return await dispatchRequest(c, identityBinding(c), 'organizations/list', { page, limit, search })
      ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations', async (c) => {
    const payload = await parsePayload(c, ['name', 'slug', 'logo']);
    const user = c.get('user');
    if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401);
    return await dispatchRequest(c, identityBinding(c), 'organizations/create', {
      ...payload, creatorUserId: user.id,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.patch('/organizations/:organizationId', async (c) => {
    const organizationId = c.req.param('organizationId');
    const payload = await parsePayload(c, ['name', 'slug', 'logo']);
    return await dispatchRequest(c, identityBinding(c), 'organizations/update', {
      organizationId, ...payload,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.delete('/organizations/:organizationId', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'organizations/delete', {
      organizationId: c.req.param('organizationId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations/:organizationId/switch', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'organizations/switch', {
      organizationId: c.req.param('organizationId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  // --- Members ---

  app.get('/organizations/:organizationId/members', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    return await dispatchRequest(c, identityBinding(c), 'organizations/members', {
      organizationId: c.req.param('organizationId'),
      page: Number(searchParams.get('page') ?? '1'),
      limit: Number(searchParams.get('limit') ?? '20'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.delete('/organizations/:organizationId/members/:userId', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'organizations/members/remove', {
      organizationId: c.req.param('organizationId'),
      userId: c.req.param('userId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  // --- Invites ---

  app.get('/organizations/:organizationId/invites', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    return await dispatchRequest(c, identityBinding(c), 'organizations/invites/list', {
      organizationId: c.req.param('organizationId'),
      page: Number(searchParams.get('page') ?? '1'),
      limit: Number(searchParams.get('limit') ?? '20'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations/:organizationId/invites', async (c) => {
    const body = await c.req.json().catch(() => null) as { email?: string; role?: string } | null;
    return await dispatchRequest(c, identityBinding(c), 'organizations/invites/create', {
      organizationId: c.req.param('organizationId'),
      email: body?.email, role: body?.role,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.delete('/organizations/:organizationId/invites/:inviteId', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'organizations/invites/delete', {
      organizationId: c.req.param('organizationId'),
      inviteId: c.req.param('inviteId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations/:organizationId/invites/:inviteId/resend', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'organizations/invites/resend', {
      organizationId: c.req.param('organizationId'),
      inviteId: c.req.param('inviteId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/invites/:token/accept', async (c) => {
    return await dispatchRequest(c, identityBinding(c), 'invites/accept', {
      token: c.req.param('token'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  return app;
}

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { Env } from '../app.js';
import { enterpriseRoutes } from './enterprise-routes.js';

function createMockKv(now: () => number): KVNamespace {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView,
      options?: KVNamespacePutOptions,
    ) {
      const ttl = options?.expirationTtl;
      const expiresAt =
        typeof ttl === 'number' ? now() + ttl * 1000 : Number.POSITIVE_INFINITY;
      store.set(key, {
        value: typeof value === 'string' ? value : String(value),
        expiresAt,
      });
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as KVNamespace;
}

function baseEnv(overrides?: Partial<Env['Bindings']>): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: createMockKv(() => Date.now()),
    EVENTS: {} as Queue,
    ...overrides,
  };
}

function createApp() {
  const app = new Hono<{
    Bindings: Env['Bindings'];
    Variables: Env['Variables'];
  }>();
  app.use('/api/v1/integrations/*', async (c, next) => {
    c.set('tenant', {
      organizationId: '11111111-1111-4111-8111-111111111111' as never,
      userId: '22222222-2222-4222-8222-222222222222' as never,
      userRole: 'owner',
      plan: 'enterprise',
    });
    c.set('db', {} as never);
    await next();
  });
  app.route('/', enterpriseRoutes);
  return app;
}

describe('enterprise routes', () => {
  it('creates, approves, and applies environment promotion requests', async () => {
    const app = createApp();
    const env = baseEnv();

    const createResponse = await app.request(
      'http://localhost/api/v1/integrations/environment-promotions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEnvironment: 'dev',
          targetEnvironment: 'stage',
          scope: {
            connectionIds: ['33333333-3333-4333-8333-333333333333'],
          },
          notes: 'Promote HubSpot connection and webhook updates',
        }),
      },
      env,
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json<{ id: string; status: string }>();
    expect(created.status).toBe('pending');

    const approveResponse = await app.request(
      `http://localhost/api/v1/integrations/environment-promotions/${created.id}/approve`,
      { method: 'POST' },
      env,
    );
    expect(approveResponse.status).toBe(200);
    await expect(approveResponse.json()).resolves.toEqual(
      expect.objectContaining({ status: 'approved' }),
    );

    const applyResponse = await app.request(
      `http://localhost/api/v1/integrations/environment-promotions/${created.id}/apply`,
      { method: 'POST' },
      env,
    );
    expect(applyResponse.status).toBe(200);
    await expect(applyResponse.json()).resolves.toEqual(
      expect.objectContaining({ status: 'applied' }),
    );

    const listResponse = await app.request(
      'http://localhost/api/v1/integrations/environment-promotions',
      undefined,
      env,
    );
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json<{
      data: Array<{ id: string }>;
    }>();
    expect(listPayload.data.map((promotion) => promotion.id)).toContain(
      created.id,
    );
  });

  it('validates promotion path and rejection workflow inputs', async () => {
    const app = createApp();
    const env = baseEnv();

    const invalidPathResponse = await app.request(
      'http://localhost/api/v1/integrations/environment-promotions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEnvironment: 'dev',
          targetEnvironment: 'prod',
          scope: {
            webhookIds: ['44444444-4444-4444-8444-444444444444'],
          },
        }),
      },
      env,
    );
    expect(invalidPathResponse.status).toBe(400);

    const created = await app.request(
      'http://localhost/api/v1/integrations/environment-promotions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEnvironment: 'stage',
          targetEnvironment: 'prod',
          scope: {
            oauthAppIds: ['55555555-5555-4555-8555-555555555555'],
          },
        }),
      },
      env,
    );
    const createdPayload = await created.json<{ id: string }>();

    const rejectWithoutReason = await app.request(
      `http://localhost/api/v1/integrations/environment-promotions/${createdPayload.id}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '   ' }),
      },
      env,
    );
    expect(rejectWithoutReason.status).toBe(400);
  });

  it('manages CRM conflict policies and preview resolution decisions', async () => {
    const app = createApp();
    const env = baseEnv();

    const getDefaultResponse = await app.request(
      'http://localhost/api/v1/integrations/crm/conflict-policies',
      undefined,
      env,
    );
    expect(getDefaultResponse.status).toBe(200);
    await expect(getDefaultResponse.json()).resolves.toEqual(
      expect.objectContaining({
        defaultStrategy: 'most_recent_wins',
      }),
    );

    const updateResponse = await app.request(
      'http://localhost/api/v1/integrations/crm/conflict-policies',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: '66666666-6666-4666-8666-666666666666',
          defaultStrategy: 'manual_review',
          fieldStrategies: {
            email: 'crm_wins',
            phone: 'mauntic_wins',
          },
        }),
      },
      env,
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual(
      expect.objectContaining({
        connectionId: '66666666-6666-4666-8666-666666666666',
        defaultStrategy: 'manual_review',
        fieldStrategies: {
          email: 'crm_wins',
          phone: 'mauntic_wins',
        },
      }),
    );

    const resolveResponse = await app.request(
      'http://localhost/api/v1/integrations/crm/conflict-policies/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: '66666666-6666-4666-8666-666666666666',
          field: 'phone',
          localValue: '+1-555-local',
          remoteValue: '+1-555-remote',
          localUpdatedAt: '2026-02-19T00:00:00.000Z',
          remoteUpdatedAt: '2026-02-21T00:00:00.000Z',
        }),
      },
      env,
    );

    expect(resolveResponse.status).toBe(200);
    await expect(resolveResponse.json()).resolves.toEqual(
      expect.objectContaining({
        decision: {
          strategy: 'mauntic_wins',
          side: 'mauntic',
        },
        resolvedValue: '+1-555-local',
      }),
    );
  });
});

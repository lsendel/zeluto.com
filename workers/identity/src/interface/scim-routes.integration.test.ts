import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScimUser,
  getScimUserById,
  listScimUsers,
  patchScimUserActive,
} from '../application/scim-provisioning-service.js';
import type { Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import { scimRoutes } from './scim-routes.js';

vi.mock('../infrastructure/database.js', () => ({
  createDatabase: vi.fn(),
}));

vi.mock('../application/scim-provisioning-service.js', async () => {
  const actual = await vi.importActual<
    typeof import('../application/scim-provisioning-service.js')
  >('../application/scim-provisioning-service.js');
  return {
    ...actual,
    listScimUsers: vi.fn(),
    getScimUserById: vi.fn(),
    createScimUser: vi.fn(),
    patchScimUserActive: vi.fn(),
  };
});

type MockTenant = {
  organizationId: string;
  userRole: string;
};

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

function baseEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {} as Hyperdrive,
    DATABASE_URL: 'postgres://db',
    KV: createMockKv(() => Date.now()),
    BETTER_AUTH_SECRET: 'secret',
    BETTER_AUTH_URL: 'https://app.zeluto.test',
    APP_DOMAIN: 'zeluto.test',
    ...overrides,
  };
}

function createScimApp(
  tenant: MockTenant = { organizationId: 'org-1', userRole: 'owner' },
) {
  const app = new Hono<{
    Bindings: Env;
    Variables: {
      tenant: MockTenant;
      db: unknown;
    };
  }>();

  app.use('/api/v1/identity/*', async (c, next) => {
    c.set('tenant', tenant);
    c.set('db', {});
    await next();
  });
  app.route('/', scimRoutes);

  return app;
}

async function issueToken(app: ReturnType<typeof createScimApp>, env: Env) {
  const response = await app.request(
    'http://localhost/api/v1/identity/scim/tokens',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Okta Provisioning', expiresInDays: 30 }),
    },
    env,
  );

  expect(response.status).toBe(201);
  return await response.json<{ id: string; token: string }>();
}

describe('scim routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDatabase).mockReturnValue({} as never);
  });

  it('issues SCIM token for owner/admin tenant users', async () => {
    const app = createScimApp({ organizationId: 'org-1', userRole: 'owner' });
    const response = await app.request(
      'http://localhost/api/v1/identity/scim/tokens',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Okta Provisioning', expiresInDays: 30 }),
      },
      baseEnv(),
    );

    expect(response.status).toBe(201);
    const payload = await response.json<{
      token: string;
      organizationId: string;
    }>();
    expect(payload.organizationId).toBe('org-1');
    expect(payload.token.startsWith('scim_')).toBe(true);
  });

  it('blocks SCIM token issuance for non-admin tenant users', async () => {
    const app = createScimApp({ organizationId: 'org-1', userRole: 'member' });
    const response = await app.request(
      'http://localhost/api/v1/identity/scim/tokens',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nope' }),
      },
      baseEnv(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'FORBIDDEN',
      message: 'Only owners/admins can issue SCIM tokens',
    });
  });

  it('returns unauthorized response for SCIM list without bearer token', async () => {
    const app = createScimApp();
    const response = await app.request(
      'http://localhost/scim/v2/Users',
      undefined,
      baseEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Missing Bearer token',
      status: '401',
      scimType: 'invalidToken',
    });
  });

  it('lists SCIM users via provisioning service when token is valid', async () => {
    const app = createScimApp();
    const env = baseEnv();
    const issued = await issueToken(app, env);
    vi.mocked(listScimUsers).mockResolvedValue({
      resources: [
        {
          id: 'user-1',
          userName: 'one@acme.com',
          active: true,
          name: { formatted: 'One User' },
          roles: [{ value: 'member', display: 'member', primary: true }],
        },
      ],
      totalResults: 1,
      startIndex: 1,
      itemsPerPage: 1,
    });

    const response = await app.request(
      'http://localhost/scim/v2/Users?startIndex=1&count=50',
      { headers: { Authorization: `Bearer ${issued.token}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/scim+json',
    );
    expect(listScimUsers).toHaveBeenCalledWith({}, 'org-1', {
      startIndex: 1,
      count: 50,
    });
    await expect(response.json()).resolves.toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      startIndex: 1,
      itemsPerPage: 1,
      Resources: [
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: 'user-1',
          userName: 'one@acme.com',
          active: true,
          name: { formatted: 'One User' },
          roles: [{ value: 'member', display: 'member', primary: true }],
        },
      ],
    });
  });

  it('creates SCIM user via provisioning service when token is valid', async () => {
    const app = createScimApp();
    const env = baseEnv();
    const issued = await issueToken(app, env);
    vi.mocked(createScimUser).mockResolvedValue({
      id: 'user-2',
      userName: 'new@acme.com',
      active: true,
      name: { formatted: 'New User' },
      roles: [{ value: 'member', display: 'member', primary: true }],
    });

    const response = await app.request(
      'http://localhost/scim/v2/Users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issued.token}`,
        },
        body: JSON.stringify({
          userName: 'new@acme.com',
          name: { givenName: 'New', familyName: 'User' },
          active: true,
        }),
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(createScimUser).toHaveBeenCalledWith({}, 'org-1', {
      userName: 'new@acme.com',
      name: 'New User',
      active: true,
    });
    await expect(response.json()).resolves.toEqual({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: 'user-2',
      userName: 'new@acme.com',
      active: true,
      name: { formatted: 'New User' },
      roles: [{ value: 'member', display: 'member', primary: true }],
    });
  });

  it('patches SCIM user active flag via provisioning service when token is valid', async () => {
    const app = createScimApp();
    const env = baseEnv();
    const issued = await issueToken(app, env);
    vi.mocked(patchScimUserActive).mockResolvedValue({
      id: 'user-3',
      userName: 'user3@acme.com',
      active: false,
      name: { formatted: 'User Three' },
      roles: [{ value: 'member', display: 'member', primary: true }],
    });

    const response = await app.request(
      'http://localhost/scim/v2/Users/user-3',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issued.token}`,
        },
        body: JSON.stringify({
          Operations: [{ op: 'replace', path: 'active', value: false }],
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(patchScimUserActive).toHaveBeenCalledWith(
      {},
      'org-1',
      'user-3',
      false,
    );
    await expect(response.json()).resolves.toEqual({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: 'user-3',
      userName: 'user3@acme.com',
      active: false,
      name: { formatted: 'User Three' },
      roles: [{ value: 'member', display: 'member', primary: true }],
    });
  });

  it('retrieves SCIM user by id via provisioning service when token is valid', async () => {
    const app = createScimApp();
    const env = baseEnv();
    const issued = await issueToken(app, env);
    vi.mocked(getScimUserById).mockResolvedValue({
      id: 'user-9',
      userName: 'user9@acme.com',
      active: true,
      name: { formatted: 'User Nine' },
      roles: [{ value: 'admin', display: 'admin', primary: true }],
    });

    const response = await app.request(
      'http://localhost/scim/v2/Users/user-9',
      { headers: { Authorization: `Bearer ${issued.token}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(getScimUserById).toHaveBeenCalledWith({}, 'org-1', 'user-9');
    await expect(response.json()).resolves.toEqual({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: 'user-9',
      userName: 'user9@acme.com',
      active: true,
      name: { formatted: 'User Nine' },
      roles: [{ value: 'admin', display: 'admin', primary: true }],
    });
  });

  it('lists and revokes SCIM tokens for owner/admin users', async () => {
    const app = createScimApp({ organizationId: 'org-1', userRole: 'owner' });
    const env = baseEnv();
    const firstIssued = await issueToken(app, env);
    await issueToken(app, env);

    const listResponse = await app.request(
      'http://localhost/api/v1/identity/scim/tokens',
      undefined,
      env,
    );

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json<{
      data: Array<{ id: string; token?: string; isActive: boolean }>;
    }>();
    expect(listPayload.data.length).toBe(2);
    expect(listPayload.data.every((token) => token.isActive === true)).toBe(
      true,
    );
    expect(listPayload.data.every((token) => token.token === undefined)).toBe(
      true,
    );

    const revokeResponse = await app.request(
      `http://localhost/api/v1/identity/scim/tokens/${firstIssued.id}`,
      { method: 'DELETE' },
      env,
    );
    expect(revokeResponse.status).toBe(204);

    const postRevokeList = await app.request(
      'http://localhost/api/v1/identity/scim/tokens',
      undefined,
      env,
    );
    const postRevokePayload = await postRevokeList.json<{
      data: Array<{ id: string; isActive: boolean }>;
    }>();
    const revoked = postRevokePayload.data.find((t) => t.id === firstIssued.id);
    expect(revoked?.isActive).toBe(false);
  });

  it('blocks revoked SCIM token from provisioning endpoints', async () => {
    const app = createScimApp();
    const env = baseEnv();
    const issued = await issueToken(app, env);

    const revokeResponse = await app.request(
      `http://localhost/api/v1/identity/scim/tokens/${issued.id}`,
      { method: 'DELETE' },
      env,
    );
    expect(revokeResponse.status).toBe(204);

    const response = await app.request(
      'http://localhost/scim/v2/Users',
      { headers: { Authorization: `Bearer ${issued.token}` } },
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid SCIM token',
      status: '401',
      scimType: 'invalidToken',
    });
  });
});

import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  createScimUser,
  getScimUserById,
  listScimUsers,
  patchScimUserActive,
  ScimUserNotFoundError,
  ScimValidationError,
} from '../application/scim-provisioning-service.js';
import {
  issueScimToken,
  listScimTokenMetadata,
  resolveScimToken,
  revokeScimTokenById,
} from '../application/scim-token-store.js';
import type { DrizzleDb, Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';

const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

type ScimEnv = {
  Bindings: Env;
  Variables: {
    tenant?: { organizationId: string; userRole: string };
    db?: DrizzleDb;
  };
};

export const scimRoutes = new Hono<ScimEnv>();
type ScimContext = Context<ScimEnv>;

scimRoutes.post('/api/v1/identity/scim/tokens', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Tenant context is required' },
      403,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners/admins can issue SCIM tokens',
      },
      403,
    );
  }

  const body = await c.req
    .json<{ name?: string; expiresInDays?: number }>()
    .catch(() => null);

  const expiresInDays = Number(body?.expiresInDays ?? 365);
  const expiresAt =
    Number.isFinite(expiresInDays) && expiresInDays > 0
      ? Date.now() + Math.floor(expiresInDays) * 24 * 60 * 60 * 1000
      : null;

  const issued = await issueScimToken(c.env.KV, {
    organizationId: tenant.organizationId,
    name: body?.name,
    expiresAt,
  });

  return c.json(issued, 201);
});

scimRoutes.get('/api/v1/identity/scim/tokens', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Tenant context is required' },
      403,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners/admins can list SCIM tokens',
      },
      403,
    );
  }

  const tokens = await listScimTokenMetadata(c.env.KV, tenant.organizationId);
  return c.json({ data: tokens });
});

scimRoutes.delete('/api/v1/identity/scim/tokens/:id', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Tenant context is required' },
      403,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners/admins can revoke SCIM tokens',
      },
      403,
    );
  }

  const revoked = await revokeScimTokenById(
    c.env.KV,
    tenant.organizationId,
    c.req.param('id'),
  );
  if (!revoked) {
    return c.json({ code: 'NOT_FOUND', message: 'SCIM token not found' }, 404);
  }

  return c.body(null, 204);
});

scimRoutes.get('/scim/v2/Users', async (c) => {
  const auth = await authorizeScimRequest(c);
  if (auth instanceof Response) return auth;

  const startIndex = Number(c.req.query('startIndex') ?? '1');
  const count = Number(c.req.query('count') ?? '100');
  const db = createDatabase(c.env);

  const list = await listScimUsers(db, auth.organizationId, {
    startIndex: Number.isFinite(startIndex) ? startIndex : 1,
    count: Number.isFinite(count) ? count : 100,
  });

  return scimJson({
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: list.totalResults,
    startIndex: list.startIndex,
    itemsPerPage: list.itemsPerPage,
    Resources: list.resources.map((resource) => ({
      schemas: [SCIM_USER_SCHEMA],
      ...resource,
    })),
  });
});

scimRoutes.get('/scim/v2/Users/:id', async (c) => {
  const auth = await authorizeScimRequest(c);
  if (auth instanceof Response) return auth;

  const db = createDatabase(c.env);

  try {
    const resource = await getScimUserById(
      db,
      auth.organizationId,
      c.req.param('id'),
    );
    return scimJson({
      schemas: [SCIM_USER_SCHEMA],
      ...resource,
    });
  } catch (error) {
    if (error instanceof ScimUserNotFoundError) {
      return scimError(404, error.message);
    }
    console.error('SCIM get user error:', error);
    return scimError(500, 'Failed to retrieve user');
  }
});

scimRoutes.post('/scim/v2/Users', async (c) => {
  const auth = await authorizeScimRequest(c);
  if (auth instanceof Response) return auth;

  const body = await c.req
    .json<{
      userName?: string;
      active?: boolean;
      name?: { formatted?: string; givenName?: string; familyName?: string };
    }>()
    .catch(() => null);

  if (!body?.userName) {
    return scimError(400, 'userName is required');
  }

  const db = createDatabase(c.env);
  const normalizedName =
    body.name?.formatted ??
    [body.name?.givenName, body.name?.familyName]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
      .trim();

  try {
    const created = await createScimUser(db, auth.organizationId, {
      userName: body.userName,
      active: body.active,
      name: normalizedName,
    });

    return scimJson(
      {
        schemas: [SCIM_USER_SCHEMA],
        ...created,
      },
      201,
    );
  } catch (error) {
    if (error instanceof ScimValidationError) {
      return scimError(400, error.message);
    }
    console.error('SCIM create user error:', error);
    return scimError(500, 'Failed to create user');
  }
});

scimRoutes.patch('/scim/v2/Users/:id', async (c) => {
  const auth = await authorizeScimRequest(c);
  if (auth instanceof Response) return auth;

  const userId = c.req.param('id');
  const body = await c.req
    .json<{
      Operations?: Array<{
        op?: string;
        path?: string;
        value?: unknown;
      }>;
    }>()
    .catch(() => null);

  const active = parseActivePatch(body);
  if (active === null) {
    return scimError(400, 'PATCH must include an active replacement operation');
  }

  const db = createDatabase(c.env);

  try {
    const patched = await patchScimUserActive(
      db,
      auth.organizationId,
      userId,
      active,
    );
    return scimJson({
      schemas: [SCIM_USER_SCHEMA],
      ...patched,
    });
  } catch (error) {
    if (error instanceof ScimUserNotFoundError) {
      return scimError(404, error.message);
    }
    console.error('SCIM patch user error:', error);
    return scimError(500, 'Failed to patch user');
  }
});

async function authorizeScimRequest(
  c: ScimContext,
): Promise<{ organizationId: string } | Response> {
  const header = c.req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return scimError(401, 'Missing Bearer token', 'invalidToken');
  }

  const token = header.slice('Bearer '.length).trim();
  const resolved = await resolveScimToken(c.env.KV, token);
  if (resolved.status === 'valid') {
    return { organizationId: resolved.organizationId };
  }

  if (resolved.status === 'expired') {
    return scimError(401, 'SCIM token expired', 'invalidToken');
  }

  return scimError(401, 'Invalid SCIM token', 'invalidToken');
}

function parseActivePatch(
  body: {
    Operations?: Array<{ op?: string; path?: string; value?: unknown }>;
  } | null,
): boolean | null {
  if (!Array.isArray(body?.Operations)) return null;

  for (const operation of body.Operations) {
    const op = operation.op?.toLowerCase();
    if (op !== 'replace') continue;

    const path = operation.path?.toLowerCase();
    if (path === 'active') {
      if (typeof operation.value === 'boolean') {
        return operation.value;
      }
      return null;
    }

    if (!path && operation.value && typeof operation.value === 'object') {
      const nested = operation.value as Record<string, unknown>;
      if (typeof nested.active === 'boolean') {
        return nested.active;
      }
    }
  }

  return null;
}

function scimJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/scim+json; charset=utf-8',
    },
  });
}

function scimError(status: number, detail: string, scimType?: string) {
  return scimJson(
    {
      schemas: [SCIM_ERROR_SCHEMA],
      detail,
      status: String(status),
      ...(scimType ? { scimType } : {}),
    },
    status,
  );
}

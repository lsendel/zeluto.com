import type { TenantContext } from '@mauntic/domain-kernel';
import {
  organizationInvites,
  organizationMembers,
  organizations,
  sessions,
  users,
} from '@mauntic/identity-domain';
import { tenantMiddleware } from '@mauntic/worker-lib';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { blockUser, unblockUser } from '../application/commands/block-user.js';
import { createOrg } from '../application/commands/create-org.js';
import { inviteMember } from '../application/commands/invite-member.js';
import { removeMember } from '../application/commands/remove-member.js';
import { updateOrg } from '../application/commands/update-org.js';
import {
  updateUser,
  updateUserRole,
} from '../application/commands/update-user.js';
import { getUser } from '../application/queries/get-user.js';
import { listOrgs } from '../application/queries/list-orgs.js';
import { listUsers } from '../application/queries/list-users.js';
import type { DrizzleDb, Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import { serializeUser } from '../utils/serialize-user.js';
import { serializeInvite, serializeOrg } from './org-serializers.js';

type DispatchEnv = {
  Bindings: Env;
  Variables: { tenant: TenantContext; db: DrizzleDb };
};

const dispatchRoutes = new Hono<DispatchEnv>();

dispatchRoutes.use('*', tenantMiddleware());
dispatchRoutes.use('*', async (c, next) => {
  const db = createDatabase(c.env);
  c.set('db', db);
  await next();
});

dispatchRoutes.post('/users/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    page?: number;
    limit?: number;
    search?: string;
  } | null;
  const page = typeof body?.page === 'number' ? body.page : 1;
  const limit = typeof body?.limit === 'number' ? body.limit : 20;
  const search =
    typeof body?.search === 'string' && body.search.length > 0
      ? body.search
      : undefined;

  const result = await listUsers(db, {
    organizationId: tenant.organizationId,
    page,
    limit,
    search,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

dispatchRoutes.post('/users/get', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    userId?: string;
  } | null;

  if (!body?.userId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'userId is required' },
      400,
    );
  }

  const user = await getUser(db, body.userId, tenant.organizationId);
  if (!user) {
    return c.json({ code: 'NOT_FOUND', message: 'User not found' }, 404);
  }

  return c.json(serializeUser(user));
});

dispatchRoutes.post('/users/update-profile', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    userId?: string;
    name?: string;
    image?: string;
  } | null;

  if (!body?.userId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'userId is required' },
      400,
    );
  }

  if (
    tenant.userId !== body.userId &&
    tenant.userRole !== 'owner' &&
    tenant.userRole !== 'admin'
  ) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      403,
    );
  }

  try {
    const updated = await updateUser(db, {
      userId: body.userId,
      name: body.name,
      image: body.image,
    });
    return c.json(updated);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'UserNotFoundError') {
      return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
    }
    console.error('Dispatch update profile failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update profile' },
      500,
    );
  }
});

dispatchRoutes.post('/users/update-role', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    userId?: string;
    role?: string;
  } | null;

  const role =
    body?.role === 'admin' || body?.role === 'user' ? body.role : undefined;

  if (!body?.userId || !role) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'userId and role are required' },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      { code: 'FORBIDDEN', message: 'Only owners and admins can change roles' },
      403,
    );
  }

  try {
    const updated = await updateUserRole(db, {
      userId: body.userId,
      role,
    });
    return c.json(updated);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'UserNotFoundError') {
      return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
    }
    console.error('Dispatch update role failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update user role' },
      500,
    );
  }
});

dispatchRoutes.post('/users/block', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    userId?: string;
  } | null;

  if (!body?.userId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'userId is required' },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      { code: 'FORBIDDEN', message: 'Only owners and admins can block users' },
      403,
    );
  }

  try {
    const updated = await blockUser(db, body.userId, tenant.organizationId);
    return c.json(updated);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'CannotBlockOwnerError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (
        error.name === 'UserNotFoundError' ||
        error.name === 'UserNotInOrgError'
      ) {
        return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
      }
    }
    console.error('Dispatch block user failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to block user' },
      500,
    );
  }
});

dispatchRoutes.post('/users/unblock', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    userId?: string;
  } | null;

  if (!body?.userId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'userId is required' },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners and admins can unblock users',
      },
      403,
    );
  }

  try {
    const updated = await unblockUser(db, body.userId);
    return c.json(updated);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'UserNotFoundError') {
      return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
    }
    console.error('Dispatch unblock user failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to unblock user' },
      500,
    );
  }
});

dispatchRoutes.post('/organizations/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    page?: number;
    limit?: number;
    search?: string;
  } | null;
  const page = typeof body?.page === 'number' ? body.page : 1;
  const limit = typeof body?.limit === 'number' ? body.limit : 20;
  const search =
    typeof body?.search === 'string' && body.search.length > 0
      ? body.search
      : undefined;

  const result = await listOrgs(db, {
    userId: tenant.userId,
    page,
    limit,
    search,
  });

  return c.json({
    data: result.data.map(serializeOrg),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

/**
 * Routes that do NOT require a tenant context (e.g. creating the first organization)
 */
const publicDispatchRoutes = new Hono<DispatchEnv>();
publicDispatchRoutes.use('*', async (c, next) => {
  const db = createDatabase(c.env);
  c.set('db', db);
  await next();
});

publicDispatchRoutes.post('/organizations/create', async (c) => {
  // We don't have tenant context yet, so we get the userId from the auth session directly
  // Note: The caller (gateway) must ensure the user is authenticated and provide the userId
  // usually via a custom header or by expecting the session to be validated here.
  // For this fix, let's assume the gateway passes x-user-id for trusted requests,
  // or we need to extract it. Since this is an internal dispatch, we trust the caller.

  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    creatorUserId?: string;
  } | null;

  if (!body?.name || !body.slug || !body.creatorUserId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'name, slug, and creatorUserId are required',
      },
      400,
    );
  }

  try {
    const org = await createOrg(db, {
      name: body.name,
      slug: body.slug,
      creatorUserId: body.creatorUserId,
    });
    return c.json(serializeOrg(org), 201);
  } catch (error) {
    console.error('Dispatch create org failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create organization' },
      500,
    );
  }
});

// Alias for onboarding flow originating from the gateway
publicDispatchRoutes.post('/onboarding/create-org', async (c) => {
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    creatorUserId?: string;
  } | null;

  if (!body?.name || !body.slug || !body.creatorUserId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'name, slug, and creatorUserId are required',
      },
      400,
    );
  }

  try {
    const org = await createOrg(db, {
      name: body.name,
      slug: body.slug,
      creatorUserId: body.creatorUserId,
    });
    return c.json(serializeOrg(org), 201);
  } catch (error) {
    console.error('Dispatch onboarding create org failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create organization' },
      500,
    );
  }
});

dispatchRoutes.route('/', publicDispatchRoutes);

dispatchRoutes.post('/organizations/update', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    name?: string;
    slug?: string;
    logo?: string;
  } | null;

  if (!body?.organizationId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'organizationId is required' },
      400,
    );
  }

  try {
    const updated = await updateOrg(
      db,
      {
        organizationId: body.organizationId,
        name: body.name,
        slug: body.slug,
        logo: body.logo,
      },
      tenant.userId,
      tenant.userRole,
    );
    return c.json(serializeOrg(updated));
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'OrgNotFoundError') {
        return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
      }
      if (error.name === 'InsufficientPermissionsError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
    }
    console.error('Dispatch update org failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update organization' },
      500,
    );
  }
});

dispatchRoutes.post('/organizations/switch', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
  } | null;

  if (!body?.organizationId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'organizationId is required' },
      400,
    );
  }

  try {
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, body.organizationId),
          eq(organizationMembers.userId, tenant.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      return c.json(
        { code: 'FORBIDDEN', message: 'Not a member of this organization' },
        403,
      );
    }

    await db
      .update(sessions)
      .set({ activeOrganizationId: body.organizationId })
      .where(eq(sessions.userId, tenant.userId));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, tenant.userId))
      .limit(1);

    return c.json({
      user: {
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image ?? null,
        role: user.role,
        isBlocked: user.isBlocked ?? false,
        lastSignedIn: user.lastSignedIn?.toISOString() ?? null,
        loginMethod: user.loginMethod ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      organizationId: body.organizationId,
    });
  } catch (error) {
    console.error('Dispatch switch organization failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to switch organization' },
      500,
    );
  }
});

dispatchRoutes.post('/organizations/members', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    page?: number;
    limit?: number;
  } | null;

  if (!body?.organizationId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'organizationId is required' },
      400,
    );
  }

  const page = typeof body.page === 'number' ? body.page : 1;
  const limit = typeof body.limit === 'number' ? body.limit : 20;
  const offset = (page - 1) * limit;

  try {
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, body.organizationId),
          eq(organizationMembers.userId, tenant.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      return c.json(
        { code: 'FORBIDDEN', message: 'Not a member of this organization' },
        403,
      );
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, body.organizationId));

    const total = countResult?.count ?? 0;

    const members = await db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, body.organizationId))
      .orderBy(organizationMembers.joinedAt)
      .limit(limit)
      .offset(offset);

    return c.json({
      data: members.map((m) => ({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        name: m.name ?? '',
        email: m.email,
        role: m.role,
        joinedAt:
          m.joinedAt instanceof Date
            ? m.joinedAt.toISOString()
            : String(m.joinedAt),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Dispatch list members failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list members' },
      500,
    );
  }
});

dispatchRoutes.post('/organizations/members/remove', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    userId?: string;
  } | null;

  if (!body?.organizationId || !body.userId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'organizationId and userId are required',
      },
      400,
    );
  }

  try {
    await removeMember(db, body.organizationId, body.userId, tenant.userRole);
    return c.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'InsufficientPermissionsError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (error.name === 'CannotRemoveOwnerError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (error.name === 'MemberNotFoundError') {
        return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
      }
    }
    console.error('Dispatch remove member failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to remove member' },
      500,
    );
  }
});

dispatchRoutes.post('/organizations/delete', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
  } | null;

  if (!body?.organizationId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'organizationId is required' },
      400,
    );
  }

  if (tenant.userRole !== 'owner') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only the owner can delete the organization',
      },
      403,
    );
  }

  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, body.organizationId),
        eq(organizationMembers.userId, tenant.userId),
      ),
    )
    .limit(1);

  if (!membership) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Organization not found or inaccessible' },
      404,
    );
  }

  await db
    .delete(organizations)
    .where(eq(organizations.id, body.organizationId));
  return c.json({ success: true });
});

dispatchRoutes.post('/organizations/invites/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    page?: number;
    limit?: number;
  } | null;

  if (!body?.organizationId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'organizationId is required' },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      { code: 'FORBIDDEN', message: 'Only owners and admins can view invites' },
      403,
    );
  }

  const page = typeof body.page === 'number' ? body.page : 1;
  const limit = typeof body.limit === 'number' ? body.limit : 20;
  const offset = (page - 1) * limit;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationInvites)
    .where(eq(organizationInvites.organizationId, body.organizationId));

  const total = countResult?.count ?? 0;

  const invites = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.organizationId, body.organizationId))
    .orderBy(organizationInvites.createdAt)
    .limit(limit)
    .offset(offset);

  return c.json({
    data: invites.map(serializeInvite),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

dispatchRoutes.post('/organizations/invites/create', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    email?: string;
    role?: string;
  } | null;

  if (!body?.organizationId || !body.email) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'organizationId and email are required',
      },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners and admins can invite members',
      },
      403,
    );
  }

  const role =
    body.role === 'admin' || body.role === 'member' ? body.role : undefined;

  try {
    const invite = await inviteMember(
      db,
      {
        organizationId: body.organizationId,
        email: body.email,
        role: role ?? 'member',
        invitedBy: tenant.userId,
      },
      tenant.userRole,
    );
    return c.json(serializeInvite(invite), 201);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'InsufficientPermissionsError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (
        error.name === 'AlreadyMemberError' ||
        error.name === 'InviteAlreadyExistsError'
      ) {
        return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
      }
    }
    console.error('Dispatch create invite failed:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create invite' },
      500,
    );
  }
});

dispatchRoutes.post('/organizations/invites/delete', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    inviteId?: string;
  } | null;

  if (!body?.organizationId || !body.inviteId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'organizationId and inviteId are required',
      },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners and admins can cancel invites',
      },
      403,
    );
  }

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.id, body.inviteId),
        eq(organizationInvites.organizationId, body.organizationId),
      ),
    )
    .limit(1);

  if (!invite) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
  }

  await db
    .delete(organizationInvites)
    .where(eq(organizationInvites.id, body.inviteId));
  return c.json({ success: true });
});

dispatchRoutes.post('/organizations/invites/resend', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    organizationId?: string;
    inviteId?: string;
  } | null;

  if (!body?.organizationId || !body.inviteId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'organizationId and inviteId are required',
      },
      400,
    );
  }

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners and admins can resend invites',
      },
      403,
    );
  }

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.id, body.inviteId),
        eq(organizationInvites.organizationId, body.organizationId),
      ),
    )
    .limit(1);

  if (!invite) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
  }

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  const [updated] = await db
    .update(organizationInvites)
    .set({ expiresAt: newExpiresAt })
    .where(eq(organizationInvites.id, body.inviteId))
    .returning();

  return c.json(serializeInvite(updated));
});

dispatchRoutes.post('/invites/accept', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    token?: string;
  } | null;

  if (!body?.token) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'token is required' },
      400,
    );
  }

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.token, body.token))
    .limit(1);

  if (!invite) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Invite not found or expired' },
      404,
    );
  }

  if (invite.expiresAt && new Date() > invite.expiresAt) {
    return c.json({ code: 'BAD_REQUEST', message: 'Invite has expired' }, 400);
  }

  if (invite.acceptedAt) {
    return c.json(
      { code: 'BAD_REQUEST', message: 'Invite already accepted' },
      400,
    );
  }

  const [existingMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, invite.organizationId),
        eq(organizationMembers.userId, tenant.userId),
      ),
    )
    .limit(1);

  if (existingMember) {
    return c.json(
      { code: 'BAD_REQUEST', message: 'Already a member of this organization' },
      400,
    );
  }

  await db.insert(organizationMembers).values({
    organizationId: invite.organizationId,
    userId: tenant.userId,
    role: invite.role,
    invitedBy: invite.invitedBy,
  });

  await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date(), status: 'accepted' })
    .where(eq(organizationInvites.id, invite.id));

  return c.json({ success: true, organizationId: invite.organizationId });
});

export default dispatchRoutes;

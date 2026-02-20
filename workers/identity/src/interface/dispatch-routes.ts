import type { TenantContext } from '@mauntic/domain-kernel';
import { asOrganizationId, asUserId } from '@mauntic/domain-kernel';
import {
  OrganizationMember,
  organizationInvites,
  organizationMembers,
  sessions,
  users,
} from '@mauntic/identity-domain';
import { tenantMiddleware } from '@mauntic/worker-lib';
import { eq, sql } from 'drizzle-orm';
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
import { DrizzleInviteRepository } from '../infrastructure/repositories/drizzle-invite-repository.js';
import { DrizzleMemberRepository } from '../infrastructure/repositories/drizzle-member-repository.js';
import { DrizzleOrganizationRepository } from '../infrastructure/repositories/drizzle-organization-repository.js';
import { DrizzleUserRepository } from '../infrastructure/repositories/drizzle-user-repository.js';
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
    const userRepo = new DrizzleUserRepository(db);
    const updated = await updateUser(userRepo, {
      userId: body.userId,
      name: body.name,
      image: body.image,
    });
    return c.json(serializeUser(updated.toProps()));
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
    const userRepo = new DrizzleUserRepository(db);
    const updated = await updateUserRole(userRepo, {
      userId: body.userId,
      role,
    });
    return c.json(serializeUser(updated.toProps()));
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
    const userRepo = new DrizzleUserRepository(db);
    const memberRepo = new DrizzleMemberRepository(db);
    const updated = await blockUser(
      userRepo,
      memberRepo,
      asUserId(body.userId),
      asOrganizationId(tenant.organizationId),
    );
    return c.json(serializeUser(updated.toProps()));
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (
        error.name === 'CannotBlockOwnerError' ||
        error.name === 'InvariantViolation'
      ) {
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
    const userRepo = new DrizzleUserRepository(db);
    const updated = await unblockUser(userRepo, asUserId(body.userId));
    return c.json(serializeUser(updated.toProps()));
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
    const orgRepo = new DrizzleOrganizationRepository(db);
    const org = await createOrg(db, orgRepo, {
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
    const orgRepo = new DrizzleOrganizationRepository(db);
    const org = await createOrg(db, orgRepo, {
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
    const orgRepo = new DrizzleOrganizationRepository(db);
    const updated = await updateOrg(
      orgRepo,
      {
        organizationId: body.organizationId,
        name: body.name,
        slug: body.slug,
        logo: body.logo,
      },
      tenant.userId,
      tenant.userRole,
    );
    return c.json(serializeOrg(updated.toProps()));
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
    const memberRepo = new DrizzleMemberRepository(db);
    const membership = await memberRepo.findByOrgAndUser(
      asOrganizationId(body.organizationId),
      asUserId(tenant.userId),
    );

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

    const userRepo = new DrizzleUserRepository(db);
    const user = await userRepo.findById(asUserId(tenant.userId));

    return c.json({
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image,
            role: user.role,
            isBlocked: user.isBlocked,
            lastSignedIn: user.lastSignedIn?.toISOString() ?? null,
            loginMethod: user.loginMethod,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          }
        : null,
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
    const memberRepo = new DrizzleMemberRepository(db);
    const membership = await memberRepo.findByOrgAndUser(
      asOrganizationId(body.organizationId),
      asUserId(tenant.userId),
    );

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
    const memberRepo = new DrizzleMemberRepository(db);
    await removeMember(
      memberRepo,
      asOrganizationId(body.organizationId),
      asUserId(body.userId),
      tenant.userRole,
    );
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

  const memberRepo = new DrizzleMemberRepository(db);
  const membership = await memberRepo.findByOrgAndUser(
    asOrganizationId(body.organizationId),
    asUserId(tenant.userId),
  );

  if (!membership) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Organization not found or inaccessible' },
      404,
    );
  }

  const orgRepo = new DrizzleOrganizationRepository(db);
  await orgRepo.delete(asOrganizationId(body.organizationId));
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

  const inviteRepo = new DrizzleInviteRepository(db);
  const invites = await inviteRepo.findByOrganization(
    asOrganizationId(body.organizationId),
  );

  return c.json({
    data: invites.map((inv) => serializeInvite(inv.toProps())),
    total: invites.length,
    page: 1,
    limit: invites.length,
    totalPages: 1,
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
    const userRepo = new DrizzleUserRepository(db);
    const memberRepo = new DrizzleMemberRepository(db);
    const inviteRepo = new DrizzleInviteRepository(db);
    const invite = await inviteMember(
      userRepo,
      memberRepo,
      inviteRepo,
      {
        organizationId: body.organizationId,
        email: body.email,
        role: role ?? 'member',
        invitedBy: tenant.userId,
      },
      tenant.userRole,
    );
    return c.json(serializeInvite(invite.toProps()), 201);
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

  const inviteRepo = new DrizzleInviteRepository(db);
  const invite = await inviteRepo.findById(body.inviteId);

  if (!invite || invite.organizationId !== body.organizationId) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
  }

  await inviteRepo.delete(body.inviteId);
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

  const inviteRepo = new DrizzleInviteRepository(db);
  const invite = await inviteRepo.findById(body.inviteId);

  if (!invite || invite.organizationId !== body.organizationId) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
  }

  // Extend expiry — entity doesn't expose expiresAt mutation, so use raw update
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  await db
    .update(organizationInvites)
    .set({ expiresAt: newExpiresAt })
    .where(eq(organizationInvites.id, body.inviteId));

  const updated = await inviteRepo.findById(body.inviteId);
  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
  }
  return c.json(serializeInvite(updated.toProps()));
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

  const inviteRepo = new DrizzleInviteRepository(db);
  const memberRepo = new DrizzleMemberRepository(db);

  const invite = await inviteRepo.findByToken(body.token);
  if (!invite) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Invite not found or expired' },
      404,
    );
  }

  if (invite.isExpired()) {
    return c.json({ code: 'BAD_REQUEST', message: 'Invite has expired' }, 400);
  }

  if (invite.acceptedAt) {
    return c.json(
      { code: 'BAD_REQUEST', message: 'Invite already accepted' },
      400,
    );
  }

  const existingMember = await memberRepo.findByOrgAndUser(
    asOrganizationId(invite.organizationId),
    asUserId(tenant.userId),
  );

  if (existingMember) {
    return c.json(
      { code: 'BAD_REQUEST', message: 'Already a member of this organization' },
      400,
    );
  }

  invite.accept();
  await inviteRepo.save(invite);

  const member = OrganizationMember.create({
    organizationId: invite.organizationId,
    userId: tenant.userId,
    role: invite.role,
    invitedBy: invite.invitedBy,
  });
  await memberRepo.save(member);

  return c.json({ success: true, organizationId: invite.organizationId });
});

export default dispatchRoutes;

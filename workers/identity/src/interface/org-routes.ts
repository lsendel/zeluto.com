import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import type { TenantContext } from '@mauntic/domain-kernel';
import {
  organizations,
  organizationMembers,
  organizationInvites,
  users,
  sessions,
} from '@mauntic/identity-domain';
import type { DrizzleDb } from '../infrastructure/database.js';
import { createOrg } from '../application/commands/create-org.js';
import { updateOrg } from '../application/commands/update-org.js';
import { inviteMember } from '../application/commands/invite-member.js';
import { removeMember } from '../application/commands/remove-member.js';
import { changeRole } from '../application/commands/change-role.js';
import { listOrgs } from '../application/queries/list-orgs.js';
import { getOrg } from '../application/queries/get-org.js';
import { serializeOrg, serializeInvite } from './org-serializers.js';

type Env = {
  Bindings: { DB: Hyperdrive };
  Variables: { tenant: TenantContext; db: DrizzleDb };
};

const orgRoutes = new Hono<Env>();

// ─── Organization CRUD ──────────────────────────────────────────────────────

// GET /api/v1/identity/organizations - List organizations for current user
orgRoutes.get('/api/v1/identity/organizations', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const search = c.req.query('search');

  try {
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
  } catch (error) {
    console.error('Error listing organizations:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list organizations' }, 500);
  }
});

// POST /api/v1/identity/organizations - Create organization
orgRoutes.post('/api/v1/identity/organizations', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const org = await createOrg(db, {
      name: body.name,
      slug: body.slug,
      creatorUserId: tenant.userId,
    });

    return c.json(serializeOrg(org), 201);
  } catch (error) {
    console.error('Error creating organization:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create organization' }, 500);
  }
});

// GET /api/v1/identity/organizations/:id - Get organization
orgRoutes.get('/api/v1/identity/organizations/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    const org = await getOrg(db, orgId, tenant.userId);

    if (!org) {
      return c.json({ code: 'NOT_FOUND', message: 'Organization not found' }, 404);
    }

    return c.json(serializeOrg(org));
  } catch (error) {
    console.error('Error getting organization:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get organization' }, 500);
  }
});

// PATCH /api/v1/identity/organizations/:id - Update organization
orgRoutes.patch('/api/v1/identity/organizations/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    const body = await c.req.json();
    const updated = await updateOrg(
      db,
      {
        organizationId: orgId,
        name: body.name,
        slug: body.slug,
        logo: body.logo,
      },
      tenant.userId,
      tenant.userRole
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
    console.error('Error updating organization:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update organization' }, 500);
  }
});

// DELETE /api/v1/identity/organizations/:id - Delete organization
orgRoutes.delete('/api/v1/identity/organizations/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  // Only owner can delete
  if (tenant.userRole !== 'owner') {
    return c.json({ code: 'FORBIDDEN', message: 'Only the owner can delete the organization' }, 403);
  }

  try {
    // Verify organization exists and user is a member
    const org = await getOrg(db, orgId, tenant.userId);
    if (!org) {
      return c.json({ code: 'NOT_FOUND', message: 'Organization not found' }, 404);
    }

    // Delete the organization (cascade will remove members and invites)
    await db
      .delete(organizations)
      .where(eq(organizations.id, orgId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete organization' }, 500);
  }
});

// POST /api/v1/identity/organizations/:id/switch - Switch active organization
orgRoutes.post('/api/v1/identity/organizations/:id/switch', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    // Verify user is a member of the target organization
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, tenant.userId)
        )
      )
      .limit(1);

    if (!membership) {
      return c.json({ code: 'FORBIDDEN', message: 'Not a member of this organization' }, 403);
    }

    // Update all active sessions for this user to point to the new organization
    await db
      .update(sessions)
      .set({ activeOrganizationId: orgId })
      .where(eq(sessions.userId, tenant.userId));

    // Get user info for response
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
      organizationId: orgId,
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to switch organization' }, 500);
  }
});

// ─── Members ────────────────────────────────────────────────────────────────

// GET /api/v1/identity/organizations/:id/members - List members
orgRoutes.get('/api/v1/identity/organizations/:id/members', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  try {
    // Verify user is a member of this org
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, tenant.userId)
        )
      )
      .limit(1);

    if (!membership) {
      return c.json({ code: 'FORBIDDEN', message: 'Not a member of this organization' }, 403);
    }

    // Count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    const total = countResult?.count ?? 0;

    // Get members with user info
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
      .where(eq(organizationMembers.organizationId, orgId))
      .orderBy(organizationMembers.joinedAt)
      .limit(limit)
      .offset(offset);

    const data = members.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      userId: m.userId,
      name: m.name ?? '',
      email: m.email,
      role: m.role,
      joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : String(m.joinedAt),
    }));

    return c.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error listing members:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list members' }, 500);
  }
});

// PATCH /api/v1/identity/organizations/:id/members/:userId/role - Change member role
orgRoutes.patch('/api/v1/identity/organizations/:id/members/:userId/role', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');
  const userId = c.req.param('userId');

  try {
    const body = await c.req.json();
    const updated = await changeRole(
      db,
      {
        organizationId: orgId,
        userId,
        role: body.role,
      },
      tenant.userId,
      tenant.userRole
    );

    // Fetch user info for the response
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return c.json({
      id: updated.id,
      organizationId: updated.organizationId,
      userId: updated.userId,
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: updated.role,
      joinedAt: updated.joinedAt instanceof Date
        ? updated.joinedAt.toISOString()
        : String(updated.joinedAt),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'InsufficientPermissionsError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (error.name === 'CannotChangeOwnRoleError') {
        return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
      }
      if (error.name === 'MemberNotFoundError') {
        return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
      }
    }
    console.error('Error changing role:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to change role' }, 500);
  }
});

// DELETE /api/v1/identity/organizations/:id/members/:userId - Remove member
orgRoutes.delete('/api/v1/identity/organizations/:id/members/:userId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');
  const userId = c.req.param('userId');

  try {
    await removeMember(db, orgId, userId, tenant.userRole);
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
    console.error('Error removing member:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to remove member' }, 500);
  }
});

// ─── Invites ────────────────────────────────────────────────────────────────

// GET /api/v1/identity/organizations/:id/invites - List invites
orgRoutes.get('/api/v1/identity/organizations/:id/invites', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  // Only owner/admin can view invites
  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json({ code: 'FORBIDDEN', message: 'Only owners and admins can view invites' }, 403);
  }

  try {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, orgId));

    const total = countResult?.count ?? 0;

    const invites = await db
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, orgId))
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
  } catch (error) {
    console.error('Error listing invites:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list invites' }, 500);
  }
});

// POST /api/v1/identity/organizations/:id/invites - Create invite
orgRoutes.post('/api/v1/identity/organizations/:id/invites', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    const body = await c.req.json();
    const invite = await inviteMember(
      db,
      {
        organizationId: orgId,
        email: body.email,
        role: body.role || 'member',
        invitedBy: tenant.userId,
      },
      tenant.userRole
    );

    return c.json(serializeInvite(invite), 201);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'InsufficientPermissionsError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (error.name === 'AlreadyMemberError') {
        return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
      }
      if (error.name === 'InviteAlreadyExistsError') {
        return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
      }
    }
    console.error('Error creating invite:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create invite' }, 500);
  }
});

// DELETE /api/v1/identity/organizations/:id/invites/:inviteId - Cancel invite
orgRoutes.delete('/api/v1/identity/organizations/:id/invites/:inviteId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');
  const inviteId = c.req.param('inviteId');

  // Only owner/admin can cancel invites
  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json({ code: 'FORBIDDEN', message: 'Only owners and admins can cancel invites' }, 403);
  }

  try {
    const [invite] = await db
      .select()
      .from(organizationInvites)
      .where(
        and(
          eq(organizationInvites.id, inviteId),
          eq(organizationInvites.organizationId, orgId)
        )
      )
      .limit(1);

    if (!invite) {
      return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
    }

    await db
      .delete(organizationInvites)
      .where(eq(organizationInvites.id, inviteId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error canceling invite:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to cancel invite' }, 500);
  }
});

// POST /api/v1/identity/invites/:token/accept - Accept invite
orgRoutes.post('/api/v1/identity/invites/:token/accept', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const token = c.req.param('token');

  try {
    // Find the invite by token
    const [invite] = await db
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.token, token))
      .limit(1);

    if (!invite) {
      return c.json({ code: 'NOT_FOUND', message: 'Invite not found or expired' }, 404);
    }

    // Check if invite has expired
    if (new Date() > invite.expiresAt) {
      return c.json({ code: 'BAD_REQUEST', message: 'Invite has expired' }, 400);
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return c.json({ code: 'BAD_REQUEST', message: 'Invite has already been accepted' }, 400);
    }

    // Check if user is already a member
    const [existingMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, invite.organizationId),
          eq(organizationMembers.userId, tenant.userId)
        )
      )
      .limit(1);

    if (existingMember) {
      return c.json({ code: 'BAD_REQUEST', message: 'Already a member of this organization' }, 400);
    }

    // Add user as member
    await db.insert(organizationMembers).values({
      organizationId: invite.organizationId,
      userId: tenant.userId,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });

    // Mark invite as accepted
    await db
      .update(organizationInvites)
      .set({ acceptedAt: new Date(), status: 'accepted' })
      .where(eq(organizationInvites.id, invite.id));

    return c.json({ success: true, organizationId: invite.organizationId });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to accept invite' }, 500);
  }
});

// POST /api/v1/identity/organizations/:id/invites/:inviteId/resend - Resend invite
orgRoutes.post('/api/v1/identity/organizations/:id/invites/:inviteId/resend', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');
  const inviteId = c.req.param('inviteId');

  // Only owner/admin can resend invites
  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json({ code: 'FORBIDDEN', message: 'Only owners and admins can resend invites' }, 403);
  }

  try {
    const [invite] = await db
      .select()
      .from(organizationInvites)
      .where(
        and(
          eq(organizationInvites.id, inviteId),
          eq(organizationInvites.organizationId, orgId)
        )
      )
      .limit(1);

    if (!invite) {
      return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
    }

    // Extend expiry by 7 days from now
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const [updated] = await db
      .update(organizationInvites)
      .set({ expiresAt: newExpiresAt })
      .where(eq(organizationInvites.id, inviteId))
      .returning();

    // TODO: Trigger email notification via queue event

    return c.json(serializeInvite(updated));
  } catch (error) {
    console.error('Error resending invite:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to resend invite' }, 500);
  }
});

export default orgRoutes;

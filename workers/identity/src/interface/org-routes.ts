import type { TenantContext } from '@mauntic/domain-kernel';
import { asOrganizationId, asUserId } from '@mauntic/domain-kernel';
import {
  organizationInvites,
  organizationMembers,
  sessions,
  users,
} from '@mauntic/identity-domain';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { changeRole } from '../application/commands/change-role.js';
import { createOrg } from '../application/commands/create-org.js';
import { inviteMember } from '../application/commands/invite-member.js';
import { removeMember } from '../application/commands/remove-member.js';
import { updateOrg } from '../application/commands/update-org.js';
import { getOrg } from '../application/queries/get-org.js';
import { listOrgs } from '../application/queries/list-orgs.js';
import type { DrizzleDb } from '../infrastructure/database.js';
import { DrizzleInviteRepository } from '../infrastructure/repositories/drizzle-invite-repository.js';
import { DrizzleMemberRepository } from '../infrastructure/repositories/drizzle-member-repository.js';
import { DrizzleOrganizationRepository } from '../infrastructure/repositories/drizzle-organization-repository.js';
import { DrizzleUserRepository } from '../infrastructure/repositories/drizzle-user-repository.js';
import { serializeInvite, serializeOrg } from './org-serializers.js';

type Env = {
  Bindings: { DB: Hyperdrive; EVENTS?: Queue };
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
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list organizations' },
      500,
    );
  }
});

// POST /api/v1/identity/organizations - Create organization
orgRoutes.post('/api/v1/identity/organizations', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const orgRepo = new DrizzleOrganizationRepository(db);
    const org = await createOrg(db, orgRepo, {
      name: body.name,
      slug: body.slug,
      creatorUserId: tenant.userId,
    });

    return c.json(serializeOrg(org), 201);
  } catch (error) {
    console.error('Error creating organization:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create organization' },
      500,
    );
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
      return c.json(
        { code: 'NOT_FOUND', message: 'Organization not found' },
        404,
      );
    }

    return c.json(serializeOrg(org));
  } catch (error) {
    console.error('Error getting organization:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get organization' },
      500,
    );
  }
});

// PATCH /api/v1/identity/organizations/:id - Update organization
orgRoutes.patch('/api/v1/identity/organizations/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    const body = await c.req.json();
    const orgRepo = new DrizzleOrganizationRepository(db);
    const updated = await updateOrg(
      orgRepo,
      {
        organizationId: orgId,
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
    console.error('Error updating organization:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update organization' },
      500,
    );
  }
});

// DELETE /api/v1/identity/organizations/:id - Delete organization
orgRoutes.delete('/api/v1/identity/organizations/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  if (tenant.userRole !== 'owner') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only the owner can delete the organization',
      },
      403,
    );
  }

  try {
    const org = await getOrg(db, orgId, tenant.userId);
    if (!org) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Organization not found' },
        404,
      );
    }

    const orgRepo = new DrizzleOrganizationRepository(db);
    await orgRepo.delete(asOrganizationId(orgId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete organization' },
      500,
    );
  }
});

// POST /api/v1/identity/organizations/:id/switch - Switch active organization
orgRoutes.post('/api/v1/identity/organizations/:id/switch', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    const memberRepo = new DrizzleMemberRepository(db);
    const membership = await memberRepo.findByOrgAndUser(
      asOrganizationId(orgId),
      asUserId(tenant.userId),
    );

    if (!membership) {
      return c.json(
        { code: 'FORBIDDEN', message: 'Not a member of this organization' },
        403,
      );
    }

    // Update sessions - stays as raw query (session table not in domain repos)
    await db
      .update(sessions)
      .set({ activeOrganizationId: orgId })
      .where(eq(sessions.userId, tenant.userId));

    const userRepo = new DrizzleUserRepository(db);
    const user = await userRepo.findById(asUserId(tenant.userId));

    return c.json({
      user: user ? serializeUser(user.toProps()) : null,
      organizationId: orgId,
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to switch organization' },
      500,
    );
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
    // Verify user is a member
    const memberRepo = new DrizzleMemberRepository(db);
    const membership = await memberRepo.findByOrgAndUser(
      asOrganizationId(orgId),
      asUserId(tenant.userId),
    );

    if (!membership) {
      return c.json(
        { code: 'FORBIDDEN', message: 'Not a member of this organization' },
        403,
      );
    }

    // Member list with user info stays as a joined query (read model)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

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
      joinedAt:
        m.joinedAt instanceof Date
          ? m.joinedAt.toISOString()
          : String(m.joinedAt),
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
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list members' },
      500,
    );
  }
});

// PATCH /api/v1/identity/organizations/:id/members/:userId/role - Change member role
orgRoutes.patch(
  '/api/v1/identity/organizations/:id/members/:userId/role',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const orgId = c.req.param('id');
    const userId = c.req.param('userId');

    try {
      const body = await c.req.json();
      const memberRepo = new DrizzleMemberRepository(db);
      const updated = await changeRole(
        memberRepo,
        {
          organizationId: orgId,
          userId,
          role: body.role,
        },
        tenant.userId,
        tenant.userRole,
      );

      // Fetch user info for the response
      const [user] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const props = updated.toProps();
      return c.json({
        id: props.id,
        organizationId: props.organizationId,
        userId: props.userId,
        name: user?.name ?? '',
        email: user?.email ?? '',
        role: props.role,
        joinedAt:
          props.joinedAt instanceof Date
            ? props.joinedAt.toISOString()
            : String(props.joinedAt),
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
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to change role' },
        500,
      );
    }
  },
);

// DELETE /api/v1/identity/organizations/:id/members/:userId - Remove member
orgRoutes.delete(
  '/api/v1/identity/organizations/:id/members/:userId',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const orgId = c.req.param('id');
    const userId = c.req.param('userId');

    try {
      const memberRepo = new DrizzleMemberRepository(db);
      await removeMember(
        memberRepo,
        asOrganizationId(orgId),
        asUserId(userId),
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
      console.error('Error removing member:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to remove member' },
        500,
      );
    }
  },
);

// ─── Invites ────────────────────────────────────────────────────────────────

// GET /api/v1/identity/organizations/:id/invites - List invites
orgRoutes.get('/api/v1/identity/organizations/:id/invites', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      { code: 'FORBIDDEN', message: 'Only owners and admins can view invites' },
      403,
    );
  }

  try {
    const inviteRepo = new DrizzleInviteRepository(db);
    const invites = await inviteRepo.findByOrganization(
      asOrganizationId(orgId),
    );

    return c.json({
      data: invites.map((inv) => serializeInvite(inv.toProps())),
      total: invites.length,
      page: 1,
      limit: invites.length,
      totalPages: 1,
    });
  } catch (error) {
    console.error('Error listing invites:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list invites' },
      500,
    );
  }
});

// POST /api/v1/identity/organizations/:id/invites - Create invite
orgRoutes.post('/api/v1/identity/organizations/:id/invites', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = c.req.param('id');

  try {
    const body = await c.req.json();
    const userRepo = new DrizzleUserRepository(db);
    const memberRepo = new DrizzleMemberRepository(db);
    const inviteRepo = new DrizzleInviteRepository(db);
    const invite = await inviteMember(
      userRepo,
      memberRepo,
      inviteRepo,
      {
        organizationId: orgId,
        email: body.email,
        role: body.role || 'member',
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
      if (error.name === 'AlreadyMemberError') {
        return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
      }
      if (error.name === 'InviteAlreadyExistsError') {
        return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
      }
    }
    console.error('Error creating invite:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create invite' },
      500,
    );
  }
});

// DELETE /api/v1/identity/organizations/:id/invites/:inviteId - Cancel invite
orgRoutes.delete(
  '/api/v1/identity/organizations/:id/invites/:inviteId',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const inviteId = c.req.param('inviteId');

    if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
      return c.json(
        {
          code: 'FORBIDDEN',
          message: 'Only owners and admins can cancel invites',
        },
        403,
      );
    }

    try {
      const inviteRepo = new DrizzleInviteRepository(db);
      const invite = await inviteRepo.findById(inviteId);

      if (!invite) {
        return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
      }

      await inviteRepo.delete(inviteId);
      return c.json({ success: true });
    } catch (error) {
      console.error('Error canceling invite:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to cancel invite' },
        500,
      );
    }
  },
);

// POST /api/v1/identity/invites/:token/accept - Accept invite
orgRoutes.post('/api/v1/identity/invites/:token/accept', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const token = c.req.param('token');

  try {
    const inviteRepo = new DrizzleInviteRepository(db);
    const memberRepo = new DrizzleMemberRepository(db);

    const invite = await inviteRepo.findByToken(token);
    if (!invite) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Invite not found or expired' },
        404,
      );
    }

    if (invite.isExpired()) {
      return c.json(
        { code: 'BAD_REQUEST', message: 'Invite has expired' },
        400,
      );
    }

    if (invite.acceptedAt) {
      return c.json(
        { code: 'BAD_REQUEST', message: 'Invite has already been accepted' },
        400,
      );
    }

    // Check if user is already a member
    const existingMember = await memberRepo.findByOrgAndUser(
      asOrganizationId(invite.organizationId),
      asUserId(tenant.userId),
    );

    if (existingMember) {
      return c.json(
        {
          code: 'BAD_REQUEST',
          message: 'Already a member of this organization',
        },
        400,
      );
    }

    // Use domain entity to accept
    invite.accept();
    await inviteRepo.save(invite);

    // Create membership
    const { OrganizationMember } = await import('@mauntic/identity-domain');
    const member = OrganizationMember.create({
      organizationId: invite.organizationId,
      userId: tenant.userId,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });
    await memberRepo.save(member);

    return c.json({ success: true, organizationId: invite.organizationId });
  } catch (error) {
    if (error instanceof Error && error.name === 'InvariantViolation') {
      return c.json({ code: 'BAD_REQUEST', message: error.message }, 400);
    }
    console.error('Error accepting invite:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to accept invite' },
      500,
    );
  }
});

// POST /api/v1/identity/organizations/:id/invites/:inviteId/resend - Resend invite
orgRoutes.post(
  '/api/v1/identity/organizations/:id/invites/:inviteId/resend',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const inviteId = c.req.param('inviteId');

    if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
      return c.json(
        {
          code: 'FORBIDDEN',
          message: 'Only owners and admins can resend invites',
        },
        403,
      );
    }

    try {
      const inviteRepo = new DrizzleInviteRepository(db);
      const invite = await inviteRepo.findById(inviteId);

      if (!invite) {
        return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
      }

      // Extend expiry by saving with updated expiresAt
      // The invite entity doesn't have a resend method, so we update expiry directly
      // via the repo (save persists current state + new expiresAt)
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      // Use raw update for resend since entity doesn't expose expiresAt mutation
      await db
        .update(organizationInvites)
        .set({ expiresAt: newExpiresAt })
        .where(eq(organizationInvites.id, inviteId))
        .returning();

      // Re-fetch to get updated entity
      const updated = await inviteRepo.findById(inviteId);
      if (!updated) {
        return c.json({ code: 'NOT_FOUND', message: 'Invite not found' }, 404);
      }

      // Publish invite resent event for email notification
      if (c.env.EVENTS) {
        await c.env.EVENTS.send({
          type: 'identity.MemberInvited',
          data: {
            organizationId: tenant.organizationId,
            email: updated.toProps().email,
            role: updated.toProps().role,
            invitedBy: tenant.userId,
          },
          metadata: {
            id: crypto.randomUUID(),
            version: 1,
            sourceContext: 'identity',
            timestamp: new Date().toISOString(),
            correlationId: updated.toProps().id,
            tenantContext: { organizationId: tenant.organizationId },
          },
        });
      }

      return c.json(serializeInvite(updated.toProps()));
    } catch (error) {
      console.error('Error resending invite:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to resend invite' },
        500,
      );
    }
  },
);

function serializeUser(user: Record<string, any>) {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    emailVerified: user.emailVerified ?? false,
    image: user.image ?? null,
    role: user.role,
    isBlocked: user.isBlocked ?? false,
    lastSignedIn:
      user.lastSignedIn instanceof Date
        ? user.lastSignedIn.toISOString()
        : (user.lastSignedIn ?? null),
    loginMethod: user.loginMethod ?? null,
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : String(user.createdAt),
    updatedAt:
      user.updatedAt instanceof Date
        ? user.updatedAt.toISOString()
        : String(user.updatedAt),
  };
}

export default orgRoutes;

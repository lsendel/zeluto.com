import type { TenantContext } from '@mauntic/domain-kernel';
import { asOrganizationId } from '@mauntic/domain-kernel';
import { organizationInvites, organizationMembers, users } from '@mauntic/identity-domain';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { DrizzleDb } from '../infrastructure/database.js';
import { DrizzleOrganizationRepository } from '../infrastructure/repositories/drizzle-organization-repository.js';
import { OrgGeneralView } from '../views/settings/general.js';
import { InviteListView } from '../views/settings/invites.js';
import { MemberListView } from '../views/settings/members.js';

type Env = {
  Bindings: Record<string, unknown>;
  Variables: { tenant: TenantContext; db: DrizzleDb };
};

/**
 * HTMX view routes for the Identity worker (Settings pages).
 *
 * Route pattern: `/app/settings/*`
 *
 * The Gateway forwards `/app/settings/*` requests here directly.
 */
export const viewRoutes = new Hono<Env>();

// GET /app/settings — Redirect to general
viewRoutes.get('/app/settings', (c) => {
  const isHtmx = c.req.header('HX-Request') === 'true';
  if (isHtmx) {
    // For HTMX requests, return a redirect header
    return new Response(null, {
      status: 200,
      headers: {
        'HX-Redirect': '/app/settings/general',
      },
    });
  }
  return c.redirect('/app/settings/general');
});

// GET /app/settings/general — Organization general settings
viewRoutes.get('/app/settings/general', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const orgRepo = new DrizzleOrganizationRepository(db);
    const org = await orgRepo.findById(asOrganizationId(tenant.organizationId));
    if (!org) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Organization not found.
        </div>,
        404,
      );
    }

    const props = org.toProps();
    return c.html(
      <OrgGeneralView
        org={{
          id: props.id,
          name: props.name,
          slug: props.slug,
          logo: props.logo,
          createdAt: props.createdAt,
        }}
      />,
    );
  } catch (error) {
    console.error('View: settings general error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load settings. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/settings/members — Member list
viewRoutes.get('/app/settings/members', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = tenant.organizationId;

  try {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    const total = countResult?.count ?? 0;

    const members = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, orgId))
      .orderBy(organizationMembers.joinedAt);

    const memberRows = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name ?? '',
      email: m.email,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    return c.html(
      <MemberListView members={memberRows} total={total} orgId={orgId} />,
    );
  } catch (error) {
    console.error('View: settings members error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load members. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/settings/invites — Invite list
viewRoutes.get('/app/settings/invites', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const orgId = tenant.organizationId;

  try {
    const rows = await db
      .select({
        id: organizationInvites.id,
        email: organizationInvites.email,
        role: organizationInvites.role,
        status: organizationInvites.status,
        expiresAt: organizationInvites.expiresAt,
        createdAt: organizationInvites.createdAt,
      })
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, orgId))
      .orderBy(organizationInvites.createdAt);

    return c.html(<InviteListView invites={rows} orgId={orgId} />);
  } catch (error) {
    console.error('View: settings invites error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load invites. Please try again.
      </div>,
      500,
    );
  }
});

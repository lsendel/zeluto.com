import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import { createAuth } from '../infrastructure/better-auth.js';
import { sessions, organizations, organizationMembers, users } from '@mauntic/identity-domain';

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * Internal session validation endpoint for Gateway service binding
 * Must be checked BEFORE Better Auth routes to intercept /api/auth/session
 */
authRoutes.get('/api/auth/session', async (c) => {
  const db = createDatabase(c.env);
  const auth = createAuth(c.env, db);

  try {
    // Get session from Better Auth (validates cookies/headers)
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user || !session?.session) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }

    // Get active organization from session
    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      // No active organization - user needs to select/create one
      return c.json({ error: 'NO_ACTIVE_ORGANIZATION' }, 400);
    }

    // Fetch organization details
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, activeOrgId))
      .limit(1);

    if (!org) {
      return c.json({ error: 'ORGANIZATION_NOT_FOUND' }, 404);
    }

    // Fetch user's role in this organization
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, activeOrgId),
          eq(organizationMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (!membership) {
      return c.json({ error: 'NOT_ORGANIZATION_MEMBER' }, 403);
    }

    // For now, derive plan from organization's planId
    // In a full implementation, we'd query the billing schema
    // For MVP, we'll use a simple mapping or default to 'free'
    const plan = org.planId ? 'pro' : 'free'; // TODO: Query billing.subscriptions for actual plan

    // Return session data in the format Gateway expects
    return c.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || session.user.email,
      },
      organization: {
        id: org.id,
        name: org.name,
        role: membership.role,
        plan,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return c.json({ error: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * Better Auth handler - delegates all other /api/auth/* requests to Better Auth
 */
authRoutes.all('/api/auth/*', async (c) => {
  const db = createDatabase(c.env);
  const auth = createAuth(c.env, db);

  // Better Auth handles the request and returns a Response
  return auth.handler(c.req.raw);
});

export default authRoutes;

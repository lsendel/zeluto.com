import { createAuth } from '../infrastructure/better-auth.js';
import { createDatabase, type Env } from '../infrastructure/database.js';
import { organizations, organizationMembers, sessions } from '@mauntic/identity-domain';
import { eq, and } from 'drizzle-orm';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface SessionValidationResult {
  status: ContentfulStatusCode;
  body: Record<string, unknown>;
}

/**
 * Shared session validation logic used by both HTTP and dispatch entrypoints.
 */
export async function validateSessionFromHeaders(
  env: Env,
  headers: Headers,
): Promise<SessionValidationResult> {
  const db = createDatabase(env);
  const auth = createAuth(env, db);

  try {
    const session = await auth.api.getSession({
      headers,
    });

    if (!session?.user || !session?.session) {
      return { status: 401, body: { error: 'UNAUTHORIZED' } };
    }

    let activeOrgId = session.session.activeOrganizationId;

    // Auto-assign org when user has exactly one membership
    if (!activeOrgId) {
      const memberships = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, session.user.id))
        .limit(2);

      if (memberships.length === 1) {
        activeOrgId = memberships[0].organizationId;
        // Persist so future requests skip this lookup
        await db
          .update(sessions)
          .set({ activeOrganizationId: activeOrgId })
          .where(eq(sessions.id, session.session.id));
      } else {
        // User is authenticated but has no org — return user data without organization
        return {
          status: 200,
          body: {
            user: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name || session.user.email,
            },
          },
        };
      }
    }

    // Fetch org + membership in a single query
    const result = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgPlanId: organizations.planId,
        memberRole: organizationMembers.role,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, session.user.id),
        ),
      )
      .where(eq(organizations.id, activeOrgId))
      .limit(1);

    const row = result[0];
    if (!row) {
      return { status: 403, body: { error: 'NOT_ORGANIZATION_MEMBER' } };
    }

    const plan = row.orgPlanId ? 'pro' : 'free';

    return {
      status: 200,
      body: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || session.user.email,
        },
        organization: {
          id: row.orgId,
          name: row.orgName,
          role: row.memberRole,
          plan,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Session validation error:', message, stack);
    return { status: 500, body: { error: 'INTERNAL_ERROR' } };
  }
}

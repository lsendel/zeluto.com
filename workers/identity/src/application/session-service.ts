import { createAuth } from '../infrastructure/better-auth.js';
import { createDatabase, type Env } from '../infrastructure/database.js';
import { organizations, organizationMembers } from '@mauntic/identity-domain';
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

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      return { status: 400, body: { error: 'NO_ACTIVE_ORGANIZATION' } };
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, activeOrgId))
      .limit(1);

    if (!org) {
      return { status: 404, body: { error: 'ORGANIZATION_NOT_FOUND' } };
    }

    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, activeOrgId),
          eq(organizationMembers.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!membership) {
      return { status: 403, body: { error: 'NOT_ORGANIZATION_MEMBER' } };
    }

    const plan = org.planId ? 'pro' : 'free';

    return {
      status: 200,
      body: {
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
      },
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { status: 500, body: { error: 'INTERNAL_ERROR' } };
  }
}

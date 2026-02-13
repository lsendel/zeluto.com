import { eq, and } from 'drizzle-orm';
import { users, organizationMembers } from '@mauntic/identity-domain';
import type { DrizzleDb } from '../../infrastructure/database.js';

/**
 * Get a user by ID, scoped to the given organization.
 * The user must be a member of the organization.
 */
export async function getUser(
  db: DrizzleDb,
  userId: string,
  organizationId: string
) {
  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
      role: users.role,
      isBlocked: users.isBlocked,
      lastSignedIn: users.lastSignedIn,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(
      organizationMembers,
      eq(users.id, organizationMembers.userId)
    )
    .where(
      and(
        eq(users.id, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  return results[0] ?? null;
}

import { eq, and } from 'drizzle-orm';
import { organizations, organizationMembers } from '@mauntic/identity-domain';
import type { DrizzleDb } from '../../infrastructure/database.js';

/**
 * Get an organization by ID, verifying the user is a member.
 */
export async function getOrg(
  db: DrizzleDb,
  orgId: string,
  userId: string
) {
  const results = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      planId: organizations.planId,
      stripeCustomerId: organizations.stripeCustomerId,
      isBlocked: organizations.isBlocked,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      eq(organizations.id, organizationMembers.organizationId)
    )
    .where(
      and(
        eq(organizations.id, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  return results[0] ?? null;
}

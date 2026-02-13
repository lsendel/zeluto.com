import { eq, sql } from 'drizzle-orm';
import { organizations, organizationMembers } from '@mauntic/identity-domain';
import type { DrizzleDb } from '../../infrastructure/database.js';

export interface ListOrgsParams {
  userId: string;
  page: number;
  limit: number;
  search?: string;
}

/**
 * List organizations for a given user.
 * Returns all organizations where the user is a member.
 */
export async function listOrgs(db: DrizzleDb, params: ListOrgsParams) {
  const { userId, page, limit, search } = params;
  const offset = (page - 1) * limit;

  const baseCondition = eq(organizationMembers.userId, userId);
  const searchCondition = search
    ? sql`${baseCondition} AND ${organizations.name} ILIKE ${'%' + search + '%'}`
    : baseCondition;

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      eq(organizations.id, organizationMembers.organizationId)
    )
    .where(searchCondition);

  const total = countResult?.count ?? 0;

  // Get paginated data
  const data = await db
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
    .where(searchCondition)
    .orderBy(organizations.createdAt)
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

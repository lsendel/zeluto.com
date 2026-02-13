import { eq, sql, ilike, or } from 'drizzle-orm';
import { users, organizationMembers } from '@mauntic/identity-domain';
import type { DrizzleDb } from '../../infrastructure/database.js';

export interface ListUsersParams {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
}

/**
 * List users in an organization, with pagination and optional search.
 * Users are joined through organizationMembers for row-level scoping.
 */
export async function listUsers(db: DrizzleDb, params: ListUsersParams) {
  const { organizationId, page, limit, search } = params;
  const offset = (page - 1) * limit;

  // Base condition: user must be a member of this organization
  const baseCondition = eq(organizationMembers.organizationId, organizationId);

  // Build where clause with optional search
  const searchCondition = search
    ? or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`)
      )
    : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(
      organizationMembers,
      eq(users.id, organizationMembers.userId)
    )
    .where(searchCondition ? sql`${baseCondition} AND ${searchCondition}` : baseCondition);

  const total = countResult?.count ?? 0;

  // Get paginated data
  const data = await db
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
    .where(searchCondition ? sql`${baseCondition} AND ${searchCondition}` : baseCondition)
    .orderBy(users.createdAt)
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

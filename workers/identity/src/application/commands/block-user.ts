import { organizationMembers, users } from '@mauntic/identity-domain';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../../infrastructure/database.js';

export async function blockUser(
  db: DrizzleDb,
  userId: string,
  organizationId: string,
) {
  // Check if user is the org owner - cannot block owner
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new UserNotInOrgError(userId, organizationId);
  }

  if (membership.role === 'owner') {
    throw new CannotBlockOwnerError();
  }

  const [updated] = await db
    .update(users)
    .set({ isBlocked: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new UserNotFoundError(userId);
  }

  return updated;
}

export async function unblockUser(db: DrizzleDb, userId: string) {
  const [updated] = await db
    .update(users)
    .set({ isBlocked: false, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new UserNotFoundError(userId);
  }

  return updated;
}

export class CannotBlockOwnerError extends Error {
  public readonly code = 'CANNOT_BLOCK_OWNER';
  constructor() {
    super('Cannot block the organization owner');
    this.name = 'CannotBlockOwnerError';
  }
}

export class UserNotInOrgError extends Error {
  public readonly code = 'USER_NOT_IN_ORG';
  constructor(userId: string, orgId: string) {
    super(`User "${userId}" is not a member of organization "${orgId}"`);
    this.name = 'UserNotInOrgError';
  }
}

export class UserNotFoundError extends Error {
  public readonly code = 'USER_NOT_FOUND';
  constructor(id: string) {
    super(`User with ID "${id}" not found`);
    this.name = 'UserNotFoundError';
  }
}

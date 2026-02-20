import { organizationMembers } from '@mauntic/identity-domain';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../../infrastructure/database.js';

export async function removeMember(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
  actorRole: string,
) {
  // Only owner/admin can remove members
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError(
      'Only owners and admins can remove members',
    );
  }

  // Find the membership
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new MemberNotFoundError(userId, organizationId);
  }

  // Cannot remove the owner
  if (membership.role === 'owner') {
    throw new CannotRemoveOwnerError();
  }

  // Delete the membership
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    );

  return { success: true };
}

export class InsufficientPermissionsError extends Error {
  public readonly code = 'INSUFFICIENT_PERMISSIONS';
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}

export class MemberNotFoundError extends Error {
  public readonly code = 'MEMBER_NOT_FOUND';
  constructor(userId: string, orgId: string) {
    super(`User "${userId}" is not a member of organization "${orgId}"`);
    this.name = 'MemberNotFoundError';
  }
}

export class CannotRemoveOwnerError extends Error {
  public readonly code = 'CANNOT_REMOVE_OWNER';
  constructor() {
    super('Cannot remove the organization owner');
    this.name = 'CannotRemoveOwnerError';
  }
}

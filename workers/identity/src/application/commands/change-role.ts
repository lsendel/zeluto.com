import { organizationMembers } from '@mauntic/identity-domain';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DrizzleDb } from '../../infrastructure/database.js';

export const ChangeRoleInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export type ChangeRoleInput = z.infer<typeof ChangeRoleInput>;

export async function changeRole(
  db: DrizzleDb,
  input: ChangeRoleInput,
  actorUserId: string,
  actorRole: string,
) {
  const parsed = ChangeRoleInput.parse(input);

  // Only owner can change roles
  if (actorRole !== 'owner') {
    throw new InsufficientPermissionsError(
      'Only the owner can change member roles',
    );
  }

  // Cannot change own role
  if (parsed.userId === actorUserId) {
    throw new CannotChangeOwnRoleError();
  }

  // Find the membership
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, parsed.organizationId),
        eq(organizationMembers.userId, parsed.userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new MemberNotFoundError(parsed.userId, parsed.organizationId);
  }

  // Update the role
  const [updated] = await db
    .update(organizationMembers)
    .set({ role: parsed.role, updatedAt: new Date() })
    .where(
      and(
        eq(organizationMembers.organizationId, parsed.organizationId),
        eq(organizationMembers.userId, parsed.userId),
      ),
    )
    .returning();

  return updated;
}

export class InsufficientPermissionsError extends Error {
  public readonly code = 'INSUFFICIENT_PERMISSIONS';
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}

export class CannotChangeOwnRoleError extends Error {
  public readonly code = 'CANNOT_CHANGE_OWN_ROLE';
  constructor() {
    super('Cannot change your own role');
    this.name = 'CannotChangeOwnRoleError';
  }
}

export class MemberNotFoundError extends Error {
  public readonly code = 'MEMBER_NOT_FOUND';
  constructor(userId: string, orgId: string) {
    super(`User "${userId}" is not a member of organization "${orgId}"`);
    this.name = 'MemberNotFoundError';
  }
}

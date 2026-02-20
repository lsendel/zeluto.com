import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import type { MemberRepository, UserRole } from '@mauntic/identity-domain';
import { z } from 'zod';

export const ChangeRoleInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export type ChangeRoleInput = z.infer<typeof ChangeRoleInput>;

export async function changeRole(
  memberRepo: MemberRepository,
  input: ChangeRoleInput,
  actorUserId: string,
  actorRole: string,
) {
  const parsed = ChangeRoleInput.parse(input);

  if (actorRole !== 'owner') {
    throw new InsufficientPermissionsError(
      'Only the owner can change member roles',
    );
  }

  if (parsed.userId === actorUserId) {
    throw new CannotChangeOwnRoleError();
  }

  const member = await memberRepo.findByOrgAndUser(
    parsed.organizationId as OrganizationId,
    parsed.userId as UserId,
  );

  if (!member) {
    throw new MemberNotFoundError(parsed.userId, parsed.organizationId);
  }

  member.changeRole(parsed.role as UserRole);
  await memberRepo.save(member);
  return member;
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

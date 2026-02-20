import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import type { MemberRepository } from '@mauntic/identity-domain';

export async function removeMember(
  memberRepo: MemberRepository,
  organizationId: OrganizationId,
  userId: UserId,
  actorRole: string,
) {
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError(
      'Only owners and admins can remove members',
    );
  }

  const member = await memberRepo.findByOrgAndUser(organizationId, userId);
  if (!member) {
    throw new MemberNotFoundError(userId, organizationId);
  }

  if (member.role === 'owner') {
    throw new CannotRemoveOwnerError();
  }

  await memberRepo.delete(member.id);
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

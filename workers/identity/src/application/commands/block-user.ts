import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import type {
  MemberRepository,
  UserRepository,
} from '@mauntic/identity-domain';

export async function blockUser(
  userRepo: UserRepository,
  memberRepo: MemberRepository,
  userId: UserId,
  organizationId: OrganizationId,
) {
  const member = await memberRepo.findByOrgAndUser(organizationId, userId);
  if (!member) {
    throw new UserNotInOrgError(userId, organizationId);
  }

  const user = await userRepo.findById(userId);
  if (!user) {
    throw new UserNotFoundError(userId);
  }

  // Domain method enforces invariant: cannot block an owner
  user.block();
  await userRepo.save(user);
  return user;
}

export async function unblockUser(userRepo: UserRepository, userId: UserId) {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new UserNotFoundError(userId);
  }

  user.unblock();
  await userRepo.save(user);
  return user;
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

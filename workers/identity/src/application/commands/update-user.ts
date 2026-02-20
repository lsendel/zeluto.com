import type { UserId } from '@mauntic/domain-kernel';
import type { UserRepository, UserRole } from '@mauntic/identity-domain';
import { z } from 'zod';

export const UpdateUserInput = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).optional(),
  image: z.string().nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export async function updateUser(
  userRepo: UserRepository,
  input: UpdateUserInput,
) {
  const parsed = UpdateUserInput.parse(input);

  const user = await userRepo.findById(parsed.userId as UserId);
  if (!user) {
    throw new UserNotFoundError(parsed.userId);
  }

  user.updateProfile({
    name: parsed.name,
  });
  await userRepo.save(user);
  return user;
}

export const UpdateUserRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'user']),
});

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInput>;

export async function updateUserRole(
  userRepo: UserRepository,
  input: UpdateUserRoleInput,
) {
  const parsed = UpdateUserRoleInput.parse(input);

  const user = await userRepo.findById(parsed.userId as UserId);
  if (!user) {
    throw new UserNotFoundError(parsed.userId);
  }

  user.changeRole(parsed.role as UserRole);
  await userRepo.save(user);
  return user;
}

export class UserNotFoundError extends Error {
  public readonly code = 'USER_NOT_FOUND';
  constructor(id: string) {
    super(`User with ID "${id}" not found`);
    this.name = 'UserNotFoundError';
  }
}

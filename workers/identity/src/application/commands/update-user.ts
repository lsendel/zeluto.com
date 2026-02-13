import { z } from 'zod';
import { eq, and, ne } from 'drizzle-orm';
import { users } from '@mauntic/identity-domain';
import type { DrizzleDb } from '../../infrastructure/database.js';

export const UpdateUserInput = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).optional(),
  image: z.string().nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export async function updateUser(db: DrizzleDb, input: UpdateUserInput) {
  const parsed = UpdateUserInput.parse(input);

  // Check user exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.userId))
    .limit(1);

  if (!existing) {
    throw new UserNotFoundError(parsed.userId);
  }

  // Build update values
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.name !== undefined) {
    updateValues.name = parsed.name;
  }
  if (parsed.image !== undefined) {
    updateValues.image = parsed.image;
  }

  const [updated] = await db
    .update(users)
    .set(updateValues)
    .where(eq(users.id, parsed.userId))
    .returning();

  return updated;
}

export const UpdateUserRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'user']),
});

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInput>;

export async function updateUserRole(db: DrizzleDb, input: UpdateUserRoleInput) {
  const parsed = UpdateUserRoleInput.parse(input);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.userId))
    .limit(1);

  if (!existing) {
    throw new UserNotFoundError(parsed.userId);
  }

  const [updated] = await db
    .update(users)
    .set({ role: parsed.role, updatedAt: new Date() })
    .where(eq(users.id, parsed.userId))
    .returning();

  return updated;
}

export class UserNotFoundError extends Error {
  public readonly code = 'USER_NOT_FOUND';
  constructor(id: string) {
    super(`User with ID "${id}" not found`);
    this.name = 'UserNotFoundError';
  }
}

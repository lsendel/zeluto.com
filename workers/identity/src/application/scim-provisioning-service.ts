import { organizationMembers, users } from '@mauntic/identity-domain';
import { and, eq, sql } from 'drizzle-orm';
import type { DrizzleDb } from '../infrastructure/database.js';

export class ScimUserNotFoundError extends Error {
  override name = 'ScimUserNotFoundError';
}

export class ScimValidationError extends Error {
  override name = 'ScimValidationError';
}

export interface ScimUserResource {
  id: string;
  userName: string;
  active: boolean;
  name: {
    formatted: string;
  };
  roles: Array<{
    value: string;
    display: string;
    primary: boolean;
  }>;
}

export interface ScimUserList {
  resources: ScimUserResource[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
}

export async function listScimUsers(
  db: DrizzleDb,
  organizationId: string,
  input?: {
    startIndex?: number;
    count?: number;
  },
): Promise<ScimUserList> {
  const startIndex = Math.max(1, input?.startIndex ?? 1);
  const count = clamp(input?.count ?? 100, 1, 200);
  const offset = startIndex - 1;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(users.createdAt)
    .limit(count)
    .offset(offset);

  return {
    resources: rows.map((row) => toScimUserResource(row, true, row.role)),
    totalResults: countRow?.total ?? 0,
    startIndex,
    itemsPerPage: rows.length,
  };
}

export async function getScimUserById(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
): Promise<ScimUserResource> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(users.id, userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ScimUserNotFoundError('User not found');
  }

  return toScimUserResource(row, true, row.role);
}

export async function createScimUser(
  db: DrizzleDb,
  organizationId: string,
  input: {
    userName: string;
    name?: string;
    active?: boolean;
  },
): Promise<ScimUserResource> {
  const email = normalizeEmail(input.userName);
  const displayName = normalizeDisplayName(input.name, email);
  const shouldBeActive = input.active ?? true;

  let [userRow] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!userRow) {
    [userRow] = await db
      .insert(users)
      .values({
        email,
        name: displayName,
        role: 'member',
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });
  } else if (displayName && displayName !== userRow.name) {
    [userRow] = await db
      .update(users)
      .set({
        name: displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRow.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });
  }

  const [existingMembership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userRow.id),
      ),
    )
    .limit(1);

  if (shouldBeActive && !existingMembership) {
    await db.insert(organizationMembers).values({
      organizationId,
      userId: userRow.id,
      role: 'member',
    });
  }

  if (!shouldBeActive && existingMembership) {
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, existingMembership.id));
  }

  return toScimUserResource(userRow, shouldBeActive, 'member');
}

export async function patchScimUserActive(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
  active: boolean,
): Promise<ScimUserResource> {
  const [userRow] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    throw new ScimUserNotFoundError('User not found');
  }

  const [membership] = await db
    .select({ id: organizationMembers.id, role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (active && !membership) {
    await db.insert(organizationMembers).values({
      organizationId,
      userId,
      role: 'member',
    });
  }

  if (!active && membership) {
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, membership.id));
  }

  return toScimUserResource(userRow, active, membership?.role ?? 'member');
}

function toScimUserResource(
  input: { id: string; email: string; name: string | null },
  active: boolean,
  role: string | null,
): ScimUserResource {
  return {
    id: input.id,
    userName: input.email,
    active,
    name: {
      formatted: normalizeDisplayName(input.name, input.email),
    },
    roles: [
      {
        value: normalizeRole(role),
        display: normalizeRole(role),
        primary: true,
      },
    ],
  };
}

function normalizeRole(role: string | null): string {
  const normalized = role?.trim().toLowerCase();
  if (
    normalized === 'owner' ||
    normalized === 'admin' ||
    normalized === 'member' ||
    normalized === 'viewer'
  ) {
    return normalized;
  }
  return 'member';
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ScimValidationError('userName must be a valid email');
  }
  return email;
}

function normalizeDisplayName(
  name: string | undefined | null,
  email: string,
): string {
  const trimmed = name?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed.slice(0, 255);
  }
  return email;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

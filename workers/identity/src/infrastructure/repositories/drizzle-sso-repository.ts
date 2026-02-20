import { ssoConnections } from '@mauntic/identity-domain';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database.js';

export type SsoConnectionRow = typeof ssoConnections.$inferSelect;

export async function findSsoConnectionsByOrg(
  db: DrizzleDb,
  orgId: string,
): Promise<SsoConnectionRow[]> {
  return db
    .select()
    .from(ssoConnections)
    .where(eq(ssoConnections.organizationId, orgId));
}

export async function findSsoConnectionById(
  db: DrizzleDb,
  orgId: string,
  id: string,
): Promise<SsoConnectionRow | null> {
  const [row] = await db
    .select()
    .from(ssoConnections)
    .where(
      and(
        eq(ssoConnections.id, id),
        eq(ssoConnections.organizationId, orgId),
      ),
    );
  return row ?? null;
}

export async function findEnabledSsoByDomain(
  db: DrizzleDb,
  emailDomain: string,
): Promise<SsoConnectionRow | null> {
  const [row] = await db
    .select()
    .from(ssoConnections)
    .where(
      and(
        eq(ssoConnections.emailDomain, emailDomain.toLowerCase()),
        eq(ssoConnections.isEnabled, true),
      ),
    );
  return row ?? null;
}

export async function createSsoConnection(
  db: DrizzleDb,
  data: typeof ssoConnections.$inferInsert,
): Promise<SsoConnectionRow> {
  const [row] = await db
    .insert(ssoConnections)
    .values(data)
    .returning();
  return row;
}

export async function updateSsoConnection(
  db: DrizzleDb,
  orgId: string,
  id: string,
  data: Partial<
    Omit<typeof ssoConnections.$inferInsert, 'id' | 'organizationId' | 'createdAt'>
  >,
): Promise<SsoConnectionRow | null> {
  const [row] = await db
    .update(ssoConnections)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(ssoConnections.id, id),
        eq(ssoConnections.organizationId, orgId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteSsoConnection(
  db: DrizzleDb,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(ssoConnections)
    .where(
      and(
        eq(ssoConnections.id, id),
        eq(ssoConnections.organizationId, orgId),
      ),
    )
    .returning({ id: ssoConnections.id });
  return result.length > 0;
}

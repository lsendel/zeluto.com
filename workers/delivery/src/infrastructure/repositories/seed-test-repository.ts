import { seed_tests } from '@mauntic/delivery-domain/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type SeedTestRow = typeof seed_tests.$inferSelect;

export async function findSeedTestById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<SeedTestRow | null> {
  const [row] = await db
    .select()
    .from(seed_tests)
    .where(
      and(eq(seed_tests.id, id), eq(seed_tests.organization_id, orgId)),
    );
  return row ?? null;
}

export async function findSeedTestsByOrg(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { limit: number },
): Promise<SeedTestRow[]> {
  return db
    .select()
    .from(seed_tests)
    .where(eq(seed_tests.organization_id, orgId))
    .orderBy(desc(seed_tests.created_at))
    .limit(opts.limit);
}

export async function insertSeedTest(
  db: NeonHttpDatabase,
  data: typeof seed_tests.$inferInsert,
): Promise<SeedTestRow> {
  const [row] = await db.insert(seed_tests).values(data).returning();
  return row;
}

export async function updateSeedTest(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<{
    status: string;
    results: unknown;
    inbox_rate: string | null;
    spam_rate: string | null;
    missing_rate: string | null;
    started_at: Date | null;
    completed_at: Date | null;
  }>,
): Promise<SeedTestRow | null> {
  const [row] = await db
    .update(seed_tests)
    .set(data)
    .where(
      and(eq(seed_tests.id, id), eq(seed_tests.organization_id, orgId)),
    )
    .returning();
  return row ?? null;
}

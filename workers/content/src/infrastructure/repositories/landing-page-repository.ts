import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { landingPages } from '@mauntic/content-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type LandingPageRow = typeof landingPages.$inferSelect;
export type LandingPageInsert = typeof landingPages.$inferInsert;

export async function findLandingPageById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<LandingPageRow | null> {
  const [page] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.id, id), eq(landingPages.organizationId, orgId)));
  return page ?? null;
}

export async function findLandingPageBySlug(
  db: NeonHttpDatabase,
  slug: string,
): Promise<LandingPageRow | null> {
  const [page] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.slug, slug), eq(landingPages.isPublished, true)));
  return page ?? null;
}

export async function findAllLandingPages(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: LandingPageRow[]; total: number }> {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(landingPages.organizationId, orgId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(landingPages.name, pattern),
        ilike(landingPages.slug, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(landingPages)
      .where(where)
      .orderBy(desc(landingPages.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landingPages)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createLandingPage(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<LandingPageInsert, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<LandingPageRow> {
  const [page] = await db
    .insert(landingPages)
    .values({ ...data, organizationId: orgId })
    .returning();
  return page;
}

export async function updateLandingPage(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<LandingPageInsert, 'id' | 'organizationId' | 'createdAt'>>,
): Promise<LandingPageRow | null> {
  const [page] = await db
    .update(landingPages)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(landingPages.id, id), eq(landingPages.organizationId, orgId)))
    .returning();
  return page ?? null;
}

export async function deleteLandingPage(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(landingPages)
    .where(and(eq(landingPages.id, id), eq(landingPages.organizationId, orgId)))
    .returning({ id: landingPages.id });
  return result.length > 0;
}

export async function incrementVisitCount(
  db: NeonHttpDatabase,
  id: string,
): Promise<void> {
  await db
    .update(landingPages)
    .set({ visitCount: sql`${landingPages.visitCount} + 1` })
    .where(eq(landingPages.id, id));
}

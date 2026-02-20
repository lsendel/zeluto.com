import { assets } from '@mauntic/content-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type AssetRow = typeof assets.$inferSelect;
export type AssetInsert = typeof assets.$inferInsert;

export async function findAssetById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<AssetRow | null> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.organizationId, orgId)));
  return asset ?? null;
}

export async function findAllAssets(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; folder?: string },
): Promise<{ data: AssetRow[]; total: number }> {
  const { page, limit, folder } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(assets.organizationId, orgId)];

  if (folder) {
    conditions.push(eq(assets.folder, folder));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(assets).where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createAsset(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<AssetInsert, 'id' | 'organizationId' | 'createdAt'>,
): Promise<AssetRow> {
  const [asset] = await db
    .insert(assets)
    .values({ ...data, organizationId: orgId })
    .returning();
  return asset;
}

export async function deleteAsset(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<AssetRow | null> {
  const [asset] = await db
    .delete(assets)
    .where(and(eq(assets.id, id), eq(assets.organizationId, orgId)))
    .returning();
  return asset ?? null;
}

export async function listAssetFolders(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<{ name: string; assetCount: number }[]> {
  const result = await db
    .select({
      name: assets.folder,
      assetCount: sql<number>`count(*)::int`,
    })
    .from(assets)
    .where(
      and(eq(assets.organizationId, orgId), sql`${assets.folder} IS NOT NULL`),
    )
    .groupBy(assets.folder);

  return result.map((r) => ({ name: r.name ?? '', assetCount: r.assetCount }));
}

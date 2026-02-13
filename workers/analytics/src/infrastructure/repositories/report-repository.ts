import { eq, and, desc, sql } from 'drizzle-orm';
import { funnelReports } from '@mauntic/analytics-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ReportRow = typeof funnelReports.$inferSelect;
export type ReportInsert = typeof funnelReports.$inferInsert;

export async function findReportById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<ReportRow | null> {
  const [row] = await db
    .select()
    .from(funnelReports)
    .where(and(eq(funnelReports.id, id), eq(funnelReports.organizationId, orgId)));
  return row ?? null;
}

export async function findAllReports(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number },
): Promise<{ data: ReportRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = eq(funnelReports.organizationId, orgId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(funnelReports)
      .where(where)
      .orderBy(desc(funnelReports.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(funnelReports)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createReport(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    name: string;
    steps: unknown;
    createdBy: string;
  },
): Promise<ReportRow> {
  const [row] = await db
    .insert(funnelReports)
    .values({
      organizationId: orgId,
      name: data.name,
      steps: data.steps,
      createdBy: data.createdBy,
    })
    .returning();
  return row;
}

export async function updateReport(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<{ name: string; steps: unknown }>,
): Promise<ReportRow | null> {
  const [row] = await db
    .update(funnelReports)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(funnelReports.id, id), eq(funnelReports.organizationId, orgId)))
    .returning();
  return row ?? null;
}

export async function deleteReport(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(funnelReports)
    .where(and(eq(funnelReports.id, id), eq(funnelReports.organizationId, orgId)))
    .returning({ id: funnelReports.id });
  return result.length > 0;
}

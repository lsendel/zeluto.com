import { eq, and } from 'drizzle-orm';
import { forecasts } from '@mauntic/revops-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ForecastRow = typeof forecasts.$inferSelect;
export type ForecastInsert = typeof forecasts.$inferInsert;

export async function findForecastByPeriod(
  db: NeonHttpDatabase,
  orgId: string,
  period: string,
): Promise<ForecastRow | null> {
  const [row] = await db
    .select()
    .from(forecasts)
    .where(and(eq(forecasts.organization_id, orgId), eq(forecasts.period, period)));
  return row ?? null;
}

export async function findForecastsByRep(
  db: NeonHttpDatabase,
  orgId: string,
  repId: string,
): Promise<ForecastRow[]> {
  return db
    .select()
    .from(forecasts)
    .where(and(eq(forecasts.organization_id, orgId), eq(forecasts.rep_id, repId)));
}

export async function upsertForecast(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ForecastInsert, 'organization_id'>,
): Promise<ForecastRow> {
  const [row] = await db
    .insert(forecasts)
    .values({ ...data, organization_id: orgId })
    .onConflictDoUpdate({
      target: forecasts.id,
      set: { ...data, updated_at: new Date() },
    })
    .returning();
  return row;
}

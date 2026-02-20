import {
  webhookDeliveries,
  webhooks,
} from '@mauntic/integrations-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type WebhookRow = typeof webhooks.$inferSelect;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;

export async function findWebhookById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<WebhookRow | null> {
  const [row] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, orgId)));
  return row ?? null;
}

export async function findAllWebhooks(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number },
): Promise<{ data: WebhookRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = eq(webhooks.organizationId, orgId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(webhooks)
      .where(where)
      .orderBy(desc(webhooks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhooks)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createWebhook(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    url: string;
    events: unknown;
    secret: string;
    isActive?: boolean;
  },
): Promise<WebhookRow> {
  const [row] = await db
    .insert(webhooks)
    .values({
      organizationId: orgId,
      url: data.url,
      events: data.events,
      secret: data.secret,
      isActive: data.isActive ?? true,
    })
    .returning();
  return row;
}

export async function updateWebhook(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<{
    url: string;
    events: unknown;
    secret: string;
    isActive: boolean;
    lastTriggeredAt: Date;
  }>,
): Promise<WebhookRow | null> {
  const [row] = await db
    .update(webhooks)
    .set(data)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, orgId)))
    .returning();
  return row ?? null;
}

export async function deleteWebhook(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, orgId)))
    .returning({ id: webhooks.id });
  return result.length > 0;
}

export async function findWebhookDeliveries(
  db: NeonHttpDatabase,
  orgId: string,
  webhookId: string,
  opts: { page: number; limit: number },
): Promise<{ data: WebhookDeliveryRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = and(
    eq(webhookDeliveries.organizationId, orgId),
    eq(webhookDeliveries.webhookId, webhookId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(webhookDeliveries)
      .where(where)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookDeliveries)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createWebhookDelivery(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    webhookId: string;
    eventType: string;
    payload: unknown;
    responseStatus?: number | null;
    responseBody?: string | null;
    attemptCount?: number;
  },
): Promise<WebhookDeliveryRow> {
  const [row] = await db
    .insert(webhookDeliveries)
    .values({
      organizationId: orgId,
      webhookId: data.webhookId,
      eventType: data.eventType,
      payload: data.payload,
      responseStatus: data.responseStatus ?? null,
      responseBody: data.responseBody ?? null,
      attemptCount: data.attemptCount ?? 1,
    })
    .returning();
  return row;
}

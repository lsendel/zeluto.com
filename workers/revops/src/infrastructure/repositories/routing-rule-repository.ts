import { routingRules } from '@mauntic/revops-domain/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type RoutingRuleRow = typeof routingRules.$inferSelect;
export type RoutingRuleInsert = typeof routingRules.$inferInsert;

export async function findRulesByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<RoutingRuleRow[]> {
  return db
    .select()
    .from(routingRules)
    .where(eq(routingRules.organization_id, orgId))
    .orderBy(desc(routingRules.priority));
}

export async function findEnabledRules(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<RoutingRuleRow[]> {
  return db
    .select()
    .from(routingRules)
    .where(
      and(
        eq(routingRules.organization_id, orgId),
        eq(routingRules.enabled, true),
      ),
    )
    .orderBy(desc(routingRules.priority));
}

export async function createRule(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<RoutingRuleInsert, 'organization_id'>,
): Promise<RoutingRuleRow> {
  const [row] = await db
    .insert(routingRules)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function updateRule(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<
    Omit<RoutingRuleInsert, 'id' | 'organization_id' | 'created_at'>
  >,
): Promise<RoutingRuleRow | null> {
  const [row] = await db
    .update(routingRules)
    .set({ ...data, updated_at: new Date() })
    .where(
      and(eq(routingRules.id, id), eq(routingRules.organization_id, orgId)),
    )
    .returning();
  return row ?? null;
}

export async function deleteRule(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(routingRules)
    .where(
      and(eq(routingRules.id, id), eq(routingRules.organization_id, orgId)),
    )
    .returning({ id: routingRules.id });
  return result.length > 0;
}

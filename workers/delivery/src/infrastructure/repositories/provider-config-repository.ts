import { provider_configs } from '@mauntic/delivery-domain/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ProviderConfigRow = typeof provider_configs.$inferSelect;
export type ProviderConfigInsert = typeof provider_configs.$inferInsert;

export async function findProviderConfigById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<ProviderConfigRow | null> {
  const [config] = await db
    .select()
    .from(provider_configs)
    .where(
      and(
        eq(provider_configs.id, id),
        eq(provider_configs.organization_id, orgId),
      ),
    );
  return config ?? null;
}

export async function findAllProviderConfigs(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<ProviderConfigRow[]> {
  return db
    .select()
    .from(provider_configs)
    .where(eq(provider_configs.organization_id, orgId))
    .orderBy(desc(provider_configs.priority));
}

export async function findActiveProviderByChannel(
  db: NeonHttpDatabase,
  orgId: string,
  channel: string,
): Promise<ProviderConfigRow | null> {
  const [config] = await db
    .select()
    .from(provider_configs)
    .where(
      and(
        eq(provider_configs.organization_id, orgId),
        eq(provider_configs.channel, channel),
        eq(provider_configs.is_active, true),
      ),
    )
    .orderBy(desc(provider_configs.priority))
    .limit(1);
  return config ?? null;
}

export async function createProviderConfig(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<
    ProviderConfigInsert,
    'id' | 'organization_id' | 'created_at' | 'updated_at'
  >,
): Promise<ProviderConfigRow> {
  const [config] = await db
    .insert(provider_configs)
    .values({ ...data, organization_id: orgId })
    .returning();
  return config;
}

export async function updateProviderConfig(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<
    Pick<ProviderConfigInsert, 'config' | 'is_active' | 'priority'>
  >,
): Promise<ProviderConfigRow | null> {
  const [config] = await db
    .update(provider_configs)
    .set({ ...data, updated_at: new Date() })
    .where(
      and(
        eq(provider_configs.id, id),
        eq(provider_configs.organization_id, orgId),
      ),
    )
    .returning();
  return config ?? null;
}

export async function deleteProviderConfig(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(provider_configs)
    .where(
      and(
        eq(provider_configs.id, id),
        eq(provider_configs.organization_id, orgId),
      ),
    )
    .returning({ id: provider_configs.id });
  return result.length > 0;
}

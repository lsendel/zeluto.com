import { eq, and, desc } from 'drizzle-orm';
import { sending_domains } from '@mauntic/delivery-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type SendingDomainRow = typeof sending_domains.$inferSelect;
export type SendingDomainInsert = typeof sending_domains.$inferInsert;

export async function findSendingDomainById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<SendingDomainRow | null> {
  const [domain] = await db
    .select()
    .from(sending_domains)
    .where(and(eq(sending_domains.id, id), eq(sending_domains.organization_id, orgId)));
  return domain ?? null;
}

export async function findAllSendingDomains(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<SendingDomainRow[]> {
  return db
    .select()
    .from(sending_domains)
    .where(eq(sending_domains.organization_id, orgId))
    .orderBy(desc(sending_domains.created_at));
}

export async function findSendingDomainByName(
  db: NeonHttpDatabase,
  orgId: string,
  domain: string,
): Promise<SendingDomainRow | null> {
  const [row] = await db
    .select()
    .from(sending_domains)
    .where(
      and(
        eq(sending_domains.organization_id, orgId),
        eq(sending_domains.domain, domain.toLowerCase()),
      ),
    );
  return row ?? null;
}

export async function createSendingDomain(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<SendingDomainInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<SendingDomainRow> {
  const [domain] = await db
    .insert(sending_domains)
    .values({ ...data, domain: data.domain.toLowerCase(), organization_id: orgId })
    .returning();
  return domain;
}

export async function updateSendingDomain(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Pick<SendingDomainInsert, 'status' | 'dns_records' | 'verified_at'>>,
): Promise<SendingDomainRow | null> {
  const [domain] = await db
    .update(sending_domains)
    .set(data)
    .where(and(eq(sending_domains.id, id), eq(sending_domains.organization_id, orgId)))
    .returning();
  return domain ?? null;
}

export async function deleteSendingDomain(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(sending_domains)
    .where(and(eq(sending_domains.id, id), eq(sending_domains.organization_id, orgId)))
    .returning({ id: sending_domains.id });
  return result.length > 0;
}

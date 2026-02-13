import { sql } from 'drizzle-orm';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';

export async function withTransaction<T>(
  db: any,
  tenantContext: TenantContext,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SET LOCAL app.organization_id = ${tenantContext.organizationId}`);
    return fn(tx);
  });
}

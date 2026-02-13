import { sql } from 'drizzle-orm';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export async function withTransaction<T>(
  db: NeonHttpDatabase,
  tenantContext: TenantContext,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL app.organization_id = ${tenantContext.organizationId}`,
    );
    return fn(tx);
  });
}

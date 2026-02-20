import { fields } from '@mauntic/crm-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type FieldRow = typeof fields.$inferSelect;
export type FieldInsert = typeof fields.$inferInsert;

export async function findFieldById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<FieldRow | null> {
  const [field] = await db
    .select()
    .from(fields)
    .where(and(eq(fields.id, id), eq(fields.organization_id, orgId)));
  return field ?? null;
}

export async function findAllFields(
  db: NeonHttpDatabase,
  orgId: string,
  entityType?: string,
): Promise<FieldRow[]> {
  const conditions = [eq(fields.organization_id, orgId)];

  if (entityType) {
    conditions.push(eq(fields.entity_type, entityType));
  }

  return db
    .select()
    .from(fields)
    .where(and(...conditions))
    .orderBy(fields.sort_order);
}

export async function createField(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<FieldInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<FieldRow> {
  const [field] = await db
    .insert(fields)
    .values({ ...data, organization_id: orgId })
    .returning();
  return field;
}

export async function updateField(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<
    Pick<FieldInsert, 'label' | 'options' | 'is_required' | 'sort_order'>
  >,
): Promise<FieldRow | null> {
  const [field] = await db
    .update(fields)
    .set(data)
    .where(and(eq(fields.id, id), eq(fields.organization_id, orgId)))
    .returning();
  return field ?? null;
}

export async function deleteField(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(fields)
    .where(and(eq(fields.id, id), eq(fields.organization_id, orgId)))
    .returning({ id: fields.id });
  return result.length > 0;
}

import { sequenceEnrollments, sequences } from '@mauntic/revops-domain/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type SequenceRow = typeof sequences.$inferSelect;
export type SequenceInsert = typeof sequences.$inferInsert;
export type EnrollmentRow = typeof sequenceEnrollments.$inferSelect;
export type EnrollmentInsert = typeof sequenceEnrollments.$inferInsert;

export async function findSequenceById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<SequenceRow | null> {
  const [row] = await db
    .select()
    .from(sequences)
    .where(and(eq(sequences.id, id), eq(sequences.organization_id, orgId)));
  return row ?? null;
}

export async function findSequencesByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<SequenceRow[]> {
  return db
    .select()
    .from(sequences)
    .where(eq(sequences.organization_id, orgId))
    .orderBy(desc(sequences.updated_at));
}

export async function createSequence(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<SequenceInsert, 'organization_id'>,
): Promise<SequenceRow> {
  const [row] = await db
    .insert(sequences)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function updateSequence(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<SequenceInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<SequenceRow | null> {
  const [row] = await db
    .update(sequences)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(sequences.id, id), eq(sequences.organization_id, orgId)))
    .returning();
  return row ?? null;
}

export async function enrollContact(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<EnrollmentInsert, 'organization_id'>,
): Promise<EnrollmentRow> {
  const [row] = await db
    .insert(sequenceEnrollments)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function findEnrollmentById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<EnrollmentRow | null> {
  const [row] = await db
    .select()
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.id, id),
        eq(sequenceEnrollments.organization_id, orgId),
      ),
    );
  return row ?? null;
}

export async function findEnrollmentsBySequence(
  db: NeonHttpDatabase,
  orgId: string,
  sequenceId: string,
): Promise<EnrollmentRow[]> {
  return db
    .select()
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.organization_id, orgId),
        eq(sequenceEnrollments.sequence_id, sequenceId),
      ),
    )
    .orderBy(desc(sequenceEnrollments.enrolled_at));
}

export async function findEnrollmentsByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<EnrollmentRow[]> {
  return db
    .select()
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.organization_id, orgId),
        eq(sequenceEnrollments.contact_id, contactId),
      ),
    );
}

export async function updateEnrollment(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<
    Omit<EnrollmentInsert, 'id' | 'organization_id' | 'enrolled_at'>
  >,
): Promise<EnrollmentRow | null> {
  const [row] = await db
    .update(sequenceEnrollments)
    .set(data)
    .where(
      and(
        eq(sequenceEnrollments.id, id),
        eq(sequenceEnrollments.organization_id, orgId),
      ),
    )
    .returning();
  return row ?? null;
}

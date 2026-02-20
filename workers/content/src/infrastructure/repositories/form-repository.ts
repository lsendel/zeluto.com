import { formSubmissions, forms } from '@mauntic/content-domain/drizzle';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type FormRow = typeof forms.$inferSelect;
export type FormInsert = typeof forms.$inferInsert;
export type FormSubmissionRow = typeof formSubmissions.$inferSelect;
export type FormSubmissionInsert = typeof formSubmissions.$inferInsert;

export async function findFormById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<FormRow | null> {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, id), eq(forms.organizationId, orgId)));
  return form ?? null;
}

export async function findAllForms(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: FormRow[]; total: number }> {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(forms.organizationId, orgId)];

  if (search) {
    conditions.push(ilike(forms.name, `%${search}%`));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(forms)
      .where(where)
      .orderBy(desc(forms.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(forms).where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createForm(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<FormInsert, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<FormRow> {
  const [form] = await db
    .insert(forms)
    .values({ ...data, organizationId: orgId })
    .returning();
  return form;
}

export async function updateForm(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<FormInsert, 'id' | 'organizationId' | 'createdAt'>>,
): Promise<FormRow | null> {
  const [form] = await db
    .update(forms)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(forms.id, id), eq(forms.organizationId, orgId)))
    .returning();
  return form ?? null;
}

export async function deleteForm(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(forms)
    .where(and(eq(forms.id, id), eq(forms.organizationId, orgId)))
    .returning({ id: forms.id });
  return result.length > 0;
}

export async function createFormSubmission(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<FormSubmissionInsert, 'id' | 'organizationId' | 'createdAt'>,
): Promise<FormSubmissionRow> {
  const [submission] = await db
    .insert(formSubmissions)
    .values({ ...data, organizationId: orgId })
    .returning();

  // Increment form submission count
  await db
    .update(forms)
    .set({
      submissionCount: sql`${forms.submissionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(forms.id, data.formId), eq(forms.organizationId, orgId)));

  return submission;
}

export async function findFormSubmissions(
  db: NeonHttpDatabase,
  orgId: string,
  formId: string,
  opts: { page: number; limit: number },
): Promise<{ data: FormSubmissionRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;

  const where = and(
    eq(formSubmissions.formId, formId),
    eq(formSubmissions.organizationId, orgId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(formSubmissions)
      .where(where)
      .orderBy(desc(formSubmissions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(formSubmissions)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

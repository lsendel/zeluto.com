import { templates } from '@mauntic/content-domain/drizzle';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type TemplateRow = typeof templates.$inferSelect;
export type TemplateInsert = typeof templates.$inferInsert;

export async function findTemplateById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<TemplateRow | null> {
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)));
  return template ?? null;
}

export async function findAllTemplates(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: TemplateRow[]; total: number }> {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(templates.organizationId, orgId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(templates.name, pattern), ilike(templates.subject, pattern))!,
    );
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(templates)
      .where(where)
      .orderBy(desc(templates.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(templates)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createTemplate(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<
    TemplateInsert,
    'id' | 'organizationId' | 'createdAt' | 'updatedAt'
  >,
): Promise<TemplateRow> {
  const [template] = await db
    .insert(templates)
    .values({ ...data, organizationId: orgId })
    .returning();
  return template;
}

export async function updateTemplate(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<TemplateInsert, 'id' | 'organizationId' | 'createdAt'>>,
): Promise<TemplateRow | null> {
  const [template] = await db
    .update(templates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)))
    .returning();
  return template ?? null;
}

export async function deleteTemplate(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.organizationId, orgId)))
    .returning({ id: templates.id });
  return result.length > 0;
}

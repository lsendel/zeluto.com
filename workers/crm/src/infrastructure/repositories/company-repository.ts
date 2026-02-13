import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import { companies } from '@mauntic/crm-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type CompanyRow = typeof companies.$inferSelect;
export type CompanyInsert = typeof companies.$inferInsert;

export async function findCompanyById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<CompanyRow | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.organization_id, orgId)));
  return company ?? null;
}

export async function findCompanyByDomain(
  db: NeonHttpDatabase,
  orgId: string,
  domain: string,
): Promise<CompanyRow | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.domain, domain), eq(companies.organization_id, orgId)));
  return company ?? null;
}

export async function findAllCompanies(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: CompanyRow[]; total: number }> {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(companies.organization_id, orgId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(companies.name, pattern),
        ilike(companies.domain, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(where)
      .orderBy(desc(companies.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createCompany(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<CompanyInsert, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
): Promise<CompanyRow> {
  const [company] = await db
    .insert(companies)
    .values({ ...data, organization_id: orgId })
    .returning();
  return company;
}

export async function updateCompany(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<CompanyInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<CompanyRow | null> {
  const [company] = await db
    .update(companies)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(companies.id, id), eq(companies.organization_id, orgId)))
    .returning();
  return company ?? null;
}

export async function deleteCompany(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(companies)
    .where(and(eq(companies.id, id), eq(companies.organization_id, orgId)))
    .returning({ id: companies.id });
  return result.length > 0;
}

export async function countCompaniesByOrg(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.organization_id, orgId));
  return result?.count ?? 0;
}

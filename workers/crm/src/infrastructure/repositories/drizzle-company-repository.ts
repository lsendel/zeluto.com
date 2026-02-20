import { Company, type CompanyRepository } from '@mauntic/crm-domain';
import { companies } from '@mauntic/crm-domain/drizzle';
import type { CompanyId, OrganizationId } from '@mauntic/domain-kernel';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleCompanyRepository implements CompanyRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(
    orgId: OrganizationId,
    id: CompanyId,
  ): Promise<Company | null> {
    const [row] = await this.db
      .select()
      .from(companies)
      .where(
        and(eq(companies.id, id), eq(companies.organization_id, orgId)),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByDomain(
    orgId: OrganizationId,
    domain: string,
  ): Promise<Company | null> {
    const [row] = await this.db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.domain, domain),
          eq(companies.organization_id, orgId),
        ),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Company[]; total: number }> {
    const { page, limit, search } = pagination;
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
    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(companies)
        .where(where)
        .orderBy(desc(companies.created_at))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(companies)
        .where(where),
    ]);

    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total: countResult[0]?.count ?? 0,
    };
  }

  async save(company: Company): Promise<void> {
    const props = company.toProps();
    const [existing] = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(companies)
        .set({
          name: props.name,
          domain: props.domain,
          industry: props.industry,
          size: props.size,
          custom_fields: props.customFields as any,
          updated_at: props.updatedAt,
        })
        .where(eq(companies.id, props.id));
    } else {
      await this.db.insert(companies).values({
        id: props.id,
        organization_id: props.organizationId,
        name: props.name,
        domain: props.domain,
        industry: props.industry,
        size: props.size,
        custom_fields: props.customFields as any,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      });
    }
  }

  async delete(orgId: OrganizationId, id: CompanyId): Promise<void> {
    await this.db
      .delete(companies)
      .where(
        and(eq(companies.id, id), eq(companies.organization_id, orgId)),
      );
  }

  private mapToEntity(row: typeof companies.$inferSelect): Company {
    return Company.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      domain: row.domain ?? null,
      industry: row.industry ?? null,
      size: row.size ?? null,
      customFields: (row.custom_fields as Record<string, unknown>) ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

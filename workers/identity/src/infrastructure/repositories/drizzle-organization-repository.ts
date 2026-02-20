import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import {
  Organization,
  type OrganizationRepository,
  organizationMembers,
  organizations,
} from '@mauntic/identity-domain';
import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

const ORG_COLUMNS = {
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug,
  logo: organizations.logo,
  planId: organizations.planId,
  stripeCustomerId: organizations.stripeCustomerId,
  isBlocked: organizations.isBlocked,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt,
};

export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  async findById(id: OrganizationId): Promise<Organization | null> {
    const [row] = await this.db
      .select(ORG_COLUMNS)
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const [row] = await this.db
      .select(ORG_COLUMNS)
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByUser(userId: UserId): Promise<Organization[]> {
    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logo: organizations.logo,
        planId: organizations.planId,
        stripeCustomerId: organizations.stripeCustomerId,
        isBlocked: organizations.isBlocked,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(eq(organizationMembers.userId, userId));
    return rows.map((r) => this.mapToEntity(r));
  }

  async save(org: Organization): Promise<void> {
    const props = org.toProps();
    const [existing] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(organizations)
        .set({
          name: props.name,
          slug: props.slug,
          logo: props.logo,
          planId: props.planId,
          stripeCustomerId: props.stripeCustomerId,
          isBlocked: props.isBlocked,
          updatedAt: props.updatedAt,
        })
        .where(eq(organizations.id, props.id));
    } else {
      await this.db.insert(organizations).values({
        id: props.id,
        name: props.name,
        slug: props.slug,
        logo: props.logo,
        planId: props.planId,
        stripeCustomerId: props.stripeCustomerId,
        isBlocked: props.isBlocked,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      });
    }
  }

  async delete(id: OrganizationId): Promise<void> {
    await this.db.delete(organizations).where(eq(organizations.id, id));
  }

  private mapToEntity(row: typeof organizations.$inferSelect): Organization {
    return Organization.reconstitute({
      id: row.id,
      name: row.name,
      slug: row.slug ?? '',
      logo: row.logo ?? null,
      planId: row.planId ?? null,
      stripeCustomerId: row.stripeCustomerId ?? null,
      isBlocked: row.isBlocked ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

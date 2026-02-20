import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import {
  type MemberRepository,
  OrganizationMember,
  organizationMembers,
} from '@mauntic/identity-domain';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

const MEMBER_COLUMNS = {
  id: organizationMembers.id,
  organizationId: organizationMembers.organizationId,
  userId: organizationMembers.userId,
  role: organizationMembers.role,
  invitedBy: organizationMembers.invitedBy,
  joinedAt: organizationMembers.joinedAt,
  updatedAt: organizationMembers.updatedAt,
};

export class DrizzleMemberRepository implements MemberRepository {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  async findById(id: string): Promise<OrganizationMember | null> {
    const [row] = await this.db
      .select(MEMBER_COLUMNS)
      .from(organizationMembers)
      .where(eq(organizationMembers.id, id))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    organizationId: OrganizationId,
  ): Promise<OrganizationMember[]> {
    const rows = await this.db
      .select(MEMBER_COLUMNS)
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
    return rows.map((r) => this.mapToEntity(r));
  }

  async findByUser(userId: UserId): Promise<OrganizationMember[]> {
    const rows = await this.db
      .select(MEMBER_COLUMNS)
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    return rows.map((r) => this.mapToEntity(r));
  }

  async findByOrgAndUser(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<OrganizationMember | null> {
    const [row] = await this.db
      .select(MEMBER_COLUMNS)
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async save(member: OrganizationMember): Promise<void> {
    const props = member.toProps();
    const [existing] = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(organizationMembers)
        .set({
          role: props.role,
          updatedAt: props.updatedAt,
        })
        .where(eq(organizationMembers.id, props.id));
    } else {
      await this.db.insert(organizationMembers).values({
        id: props.id,
        organizationId: props.organizationId,
        userId: props.userId,
        role: props.role,
        invitedBy: props.invitedBy,
        joinedAt: props.joinedAt,
        updatedAt: props.updatedAt,
      });
    }
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, id));
  }

  private mapToEntity(
    row: typeof organizationMembers.$inferSelect,
  ): OrganizationMember {
    return OrganizationMember.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      role: row.role as 'owner' | 'admin' | 'member' | 'viewer',
      invitedBy: row.invitedBy ?? null,
      joinedAt: row.joinedAt,
      updatedAt: row.updatedAt,
    });
  }
}

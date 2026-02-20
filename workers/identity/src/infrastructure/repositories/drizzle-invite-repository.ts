import type { OrganizationId } from '@mauntic/domain-kernel';
import {
  type InviteRepository,
  OrganizationInvite,
  organizationInvites,
} from '@mauntic/identity-domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

const INVITE_COLUMNS = {
  id: organizationInvites.id,
  organizationId: organizationInvites.organizationId,
  email: organizationInvites.email,
  role: organizationInvites.role,
  token: organizationInvites.token,
  invitedBy: organizationInvites.invitedBy,
  status: organizationInvites.status,
  expiresAt: organizationInvites.expiresAt,
  acceptedAt: organizationInvites.acceptedAt,
  createdAt: organizationInvites.createdAt,
};

export class DrizzleInviteRepository implements InviteRepository {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  async findById(id: string): Promise<OrganizationInvite | null> {
    const [row] = await this.db
      .select(INVITE_COLUMNS)
      .from(organizationInvites)
      .where(eq(organizationInvites.id, id))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByToken(token: string): Promise<OrganizationInvite | null> {
    const [row] = await this.db
      .select(INVITE_COLUMNS)
      .from(organizationInvites)
      .where(eq(organizationInvites.token, token))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    organizationId: OrganizationId,
  ): Promise<OrganizationInvite[]> {
    const rows = await this.db
      .select(INVITE_COLUMNS)
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, organizationId))
      .orderBy(organizationInvites.createdAt);
    return rows.map((r) => this.mapToEntity(r));
  }

  async findPendingByEmail(email: string): Promise<OrganizationInvite[]> {
    const rows = await this.db
      .select(INVITE_COLUMNS)
      .from(organizationInvites)
      .where(
        and(
          eq(organizationInvites.email, email),
          isNull(organizationInvites.acceptedAt),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async save(invite: OrganizationInvite): Promise<void> {
    const props = invite.toProps();
    const [existing] = await this.db
      .select({ id: organizationInvites.id })
      .from(organizationInvites)
      .where(eq(organizationInvites.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(organizationInvites)
        .set({
          expiresAt: props.expiresAt,
          acceptedAt: props.acceptedAt ?? null,
          status: props.acceptedAt ? 'accepted' : 'pending',
        })
        .where(eq(organizationInvites.id, props.id));
    } else {
      await this.db.insert(organizationInvites).values({
        id: props.id,
        organizationId: props.organizationId,
        email: props.email,
        role: props.role,
        token: props.token,
        invitedBy: props.invitedBy,
        expiresAt: props.expiresAt,
        acceptedAt: props.acceptedAt ?? null,
        createdAt: props.createdAt,
      });
    }
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(organizationInvites)
      .where(eq(organizationInvites.id, id));
  }

  private mapToEntity(
    row: typeof organizationInvites.$inferSelect,
  ): OrganizationInvite {
    return OrganizationInvite.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      role: row.role as 'owner' | 'admin' | 'member' | 'viewer',
      token: row.token,
      invitedBy: row.invitedBy,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt ?? null,
      createdAt: row.createdAt,
    });
  }
}

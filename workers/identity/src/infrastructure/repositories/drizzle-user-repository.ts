import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import {
  organizationMembers,
  User,
  type UserRepository,
  users,
} from '@mauntic/identity-domain';
import { eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

const USER_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  emailVerified: users.emailVerified,
  image: users.image,
  role: users.role,
  isBlocked: users.isBlocked,
  lastSignedIn: users.lastSignedIn,
  loginMethod: users.loginMethod,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  async findById(id: UserId): Promise<User | null> {
    const [row] = await this.db
      .select(USER_COLUMNS)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select(USER_COLUMNS)
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    organizationId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ users: User[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const baseCondition = eq(
      organizationMembers.organizationId,
      organizationId,
    );

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
      .where(baseCondition);

    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        role: users.role,
        isBlocked: users.isBlocked,
        lastSignedIn: users.lastSignedIn,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
      .where(baseCondition)
      .orderBy(users.createdAt)
      .limit(pagination.limit)
      .offset(offset);

    return {
      users: rows.map((r) => this.mapToEntity(r)),
      total: countResult?.count ?? 0,
    };
  }

  async save(user: User): Promise<void> {
    const props = user.toProps();
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(users)
        .set({
          name: props.name,
          email: props.email,
          emailVerified: props.emailVerified,
          image: props.image,
          role: props.role,
          isBlocked: props.isBlocked,
          lastSignedIn: props.lastSignedIn,
          loginMethod: props.loginMethod,
          updatedAt: props.updatedAt,
        })
        .where(eq(users.id, props.id));
    } else {
      await this.db.insert(users).values({
        id: props.id,
        name: props.name,
        email: props.email,
        emailVerified: props.emailVerified,
        image: props.image,
        role: props.role,
        isBlocked: props.isBlocked,
        lastSignedIn: props.lastSignedIn,
        loginMethod: props.loginMethod,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      });
    }
  }

  async delete(id: UserId): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  private mapToEntity(
    row: Record<string, unknown> & { id: string; email: string },
  ): User {
    return User.reconstitute({
      id: row.id as string,
      email: row.email as string,
      name: (row.name as string) ?? '',
      role: (row.role as 'owner' | 'admin' | 'member' | 'viewer') ?? 'member',
      isBlocked: (row.isBlocked as boolean) ?? false,
      emailVerified: (row.emailVerified as boolean) ?? false,
      image: (row.image as string | null) ?? null,
      loginMethod: (row.loginMethod as string | null) ?? null,
      lastSignedIn: (row.lastSignedIn as Date | null) ?? null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    });
  }
}

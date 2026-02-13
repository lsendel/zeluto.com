import { z } from 'zod';
import { UserRoleSchema, type UserRole } from './user.js';

export const OrganizationMemberPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: UserRoleSchema,
  invitedBy: z.string().uuid().nullable(),
  joinedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type OrganizationMemberProps = z.infer<typeof OrganizationMemberPropsSchema>;

export class OrganizationMember {
  private constructor(private props: OrganizationMemberProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    userId: string;
    role: UserRole;
    invitedBy?: string | null;
  }): OrganizationMember {
    return new OrganizationMember(
      OrganizationMemberPropsSchema.parse({
        ...input,
        id: crypto.randomUUID(),
        invitedBy: input.invitedBy ?? null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: OrganizationMemberProps): OrganizationMember {
    return new OrganizationMember(OrganizationMemberPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get invitedBy(): string | null {
    return this.props.invitedBy;
  }
  get joinedAt(): Date {
    return this.props.joinedAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  changeRole(newRole: UserRole): void {
    UserRoleSchema.parse(newRole);
    this.props.role = newRole;
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<OrganizationMemberProps> {
    return Object.freeze({ ...this.props });
  }
}

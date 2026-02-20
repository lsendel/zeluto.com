import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';
import { type UserRole, UserRoleSchema } from './user.js';

export const OrganizationInvitePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  token: z.string().min(1),
  invitedBy: z.string().uuid(),
  expiresAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type OrganizationInviteProps = z.infer<
  typeof OrganizationInvitePropsSchema
>;

export class OrganizationInvite {
  private constructor(private props: OrganizationInviteProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    email: string;
    role?: UserRole;
    invitedBy: string;
    expiresInMs?: number;
  }): OrganizationInvite {
    const now = new Date();
    // Default expiry: 7 days
    const expiresAt = new Date(
      now.getTime() + (input.expiresInMs ?? 7 * 24 * 60 * 60 * 1000),
    );

    return new OrganizationInvite(
      OrganizationInvitePropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        email: input.email.trim().toLowerCase(),
        role: input.role ?? 'member',
        token: crypto.randomUUID(),
        invitedBy: input.invitedBy,
        expiresAt,
        acceptedAt: null,
        createdAt: now,
      }),
    );
  }

  static reconstitute(props: OrganizationInviteProps): OrganizationInvite {
    return new OrganizationInvite(OrganizationInvitePropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get email(): string {
    return this.props.email;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get token(): string {
    return this.props.token;
  }
  get invitedBy(): string {
    return this.props.invitedBy;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get acceptedAt(): Date | null {
    return this.props.acceptedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  // ---- Domain methods ----

  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  accept(): void {
    if (this.props.acceptedAt !== null) {
      throw new InvariantViolation('Invite has already been accepted');
    }
    if (this.isExpired()) {
      throw new InvariantViolation('Invite has expired');
    }
    this.props.acceptedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<OrganizationInviteProps> {
    return Object.freeze({ ...this.props });
  }
}

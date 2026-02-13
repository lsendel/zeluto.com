import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const UserRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserPropsSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  isBlocked: z.boolean(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  loginMethod: z.string().nullable(),
  lastSignedIn: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserProps = z.infer<typeof UserPropsSchema>;

export class User {
  private constructor(private props: UserProps) {}

  // ---- Factory methods ----

  static create(input: {
    email: string;
    name: string;
    role?: UserRole;
  }): User {
    return new User(
      UserPropsSchema.parse({
        ...input,
        id: crypto.randomUUID(),
        role: input.role ?? 'member',
        isBlocked: false,
        emailVerified: false,
        image: null,
        loginMethod: null,
        lastSignedIn: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: UserProps): User {
    return new User(UserPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get isBlocked(): boolean {
    return this.props.isBlocked;
  }
  get emailVerified(): boolean {
    return this.props.emailVerified;
  }
  get image(): string | null {
    return this.props.image;
  }
  get loginMethod(): string | null {
    return this.props.loginMethod;
  }
  get lastSignedIn(): Date | null {
    return this.props.lastSignedIn;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  block(): void {
    if (this.props.role === 'owner') {
      throw new InvariantViolation('Cannot block an owner');
    }
    this.props.isBlocked = true;
    this.props.updatedAt = new Date();
  }

  unblock(): void {
    this.props.isBlocked = false;
    this.props.updatedAt = new Date();
  }

  updateProfile(input: { name?: string; email?: string }): void {
    if (input.name !== undefined) {
      if (input.name.length < 1) {
        throw new InvariantViolation('Name must not be empty');
      }
      this.props.name = input.name;
    }
    if (input.email !== undefined) {
      // Re-validate email format
      z.string().email().parse(input.email);
      this.props.email = input.email.trim().toLowerCase();
      this.props.emailVerified = false;
    }
    this.props.updatedAt = new Date();
  }

  changeRole(newRole: UserRole): void {
    UserRoleSchema.parse(newRole);
    this.props.role = newRole;
    this.props.updatedAt = new Date();
  }

  recordSignIn(method?: string): void {
    this.props.lastSignedIn = new Date();
    if (method !== undefined) {
      this.props.loginMethod = method;
    }
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<UserProps> {
    return Object.freeze({ ...this.props });
  }
}

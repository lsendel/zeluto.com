import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';
import { SlugSchema } from '../value-objects/slug.js';

export const OrganizationPropsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: SlugSchema,
  logo: z.string().nullable(),
  planId: z.string().uuid().nullable(),
  stripeCustomerId: z.string().nullable(),
  isBlocked: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type OrganizationProps = z.infer<typeof OrganizationPropsSchema>;

export class Organization {
  private constructor(private props: OrganizationProps) {}

  // ---- Factory methods ----

  static create(input: { name: string; slug: string }): Organization {
    return new Organization(
      OrganizationPropsSchema.parse({
        ...input,
        id: crypto.randomUUID(),
        logo: null,
        planId: null,
        stripeCustomerId: null,
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: OrganizationProps): Organization {
    return new Organization(OrganizationPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get slug(): string {
    return this.props.slug;
  }
  get logo(): string | null {
    return this.props.logo;
  }
  get planId(): string | null {
    return this.props.planId;
  }
  get stripeCustomerId(): string | null {
    return this.props.stripeCustomerId;
  }
  get isBlocked(): boolean {
    return this.props.isBlocked;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  update(input: { name?: string; logo?: string | null }): void {
    if (input.name !== undefined) {
      if (input.name.length < 1) {
        throw new InvariantViolation('Organization name must not be empty');
      }
      this.props.name = input.name;
    }
    if (input.logo !== undefined) {
      this.props.logo = input.logo;
    }
    this.props.updatedAt = new Date();
  }

  block(): void {
    this.props.isBlocked = true;
    this.props.updatedAt = new Date();
  }

  unblock(): void {
    this.props.isBlocked = false;
    this.props.updatedAt = new Date();
  }

  setPlan(planId: string, stripeCustomerId?: string): void {
    z.string().uuid().parse(planId);
    this.props.planId = planId;
    if (stripeCustomerId !== undefined) {
      this.props.stripeCustomerId = stripeCustomerId;
    }
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<OrganizationProps> {
    return Object.freeze({ ...this.props });
  }
}

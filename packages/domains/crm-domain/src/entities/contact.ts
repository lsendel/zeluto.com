import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const ContactStatusSchema = z.enum([
  'active',
  'unsubscribed',
  'bounced',
  'do_not_contact',
]);

export type ContactStatus = z.infer<typeof ContactStatusSchema>;

export const ContactPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  status: ContactStatusSchema,
  companyId: z.string().uuid().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  lastActivityAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ContactProps = z.infer<typeof ContactPropsSchema>;

export class Contact {
  private constructor(private props: ContactProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    customFields?: Record<string, unknown>;
  }): Contact {
    if (input.email !== undefined && input.email !== null) {
      const result = z.string().email().safeParse(input.email);
      if (!result.success) {
        throw new InvariantViolation('Invalid email format');
      }
    }

    return new Contact(
      ContactPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        email: input.email ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        status: 'active',
        companyId: null,
        customFields: input.customFields ?? {},
        lastActivityAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ContactProps): Contact {
    return new Contact(ContactPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get email(): string | null {
    return this.props.email;
  }
  get firstName(): string | null {
    return this.props.firstName;
  }
  get lastName(): string | null {
    return this.props.lastName;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get status(): ContactStatus {
    return this.props.status;
  }
  get companyId(): string | null {
    return this.props.companyId;
  }
  get customFields(): Record<string, unknown> {
    return this.props.customFields;
  }
  get lastActivityAt(): Date | null {
    return this.props.lastActivityAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  update(input: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    customFields?: Record<string, unknown>;
  }): void {
    if (input.email !== undefined && input.email !== null) {
      const result = z.string().email().safeParse(input.email);
      if (!result.success) {
        throw new InvariantViolation('Invalid email format');
      }
      this.props.email = input.email;
    } else if (input.email === null) {
      this.props.email = null;
    }

    if (input.firstName !== undefined) {
      this.props.firstName = input.firstName;
    }
    if (input.lastName !== undefined) {
      this.props.lastName = input.lastName;
    }
    if (input.phone !== undefined) {
      this.props.phone = input.phone;
    }
    if (input.customFields !== undefined) {
      this.props.customFields = { ...this.props.customFields, ...input.customFields };
    }
    this.props.updatedAt = new Date();
  }

  unsubscribe(): void {
    this.props.status = 'unsubscribed';
    this.props.updatedAt = new Date();
  }

  markBounced(): void {
    this.props.status = 'bounced';
    this.props.updatedAt = new Date();
  }

  markDoNotContact(): void {
    this.props.status = 'do_not_contact';
    this.props.updatedAt = new Date();
  }

  reactivate(): void {
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  setCompany(companyId: string | null): void {
    if (companyId !== null) {
      z.string().uuid().parse(companyId);
    }
    this.props.companyId = companyId;
    this.props.updatedAt = new Date();
  }

  setCustomField(key: string, value: unknown): void {
    this.props.customFields = { ...this.props.customFields, [key]: value };
    this.props.updatedAt = new Date();
  }

  recordActivity(): void {
    this.props.lastActivityAt = new Date();
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<ContactProps> {
    return Object.freeze({ ...this.props });
  }
}

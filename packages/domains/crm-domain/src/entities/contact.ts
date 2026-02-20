import { AggregateRoot, InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

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

export class Contact extends AggregateRoot<ContactProps> {
  private constructor(props: ContactProps) {
    super(props.id, props);
  }

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

    const props = ContactPropsSchema.parse({
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
    });

    const contact = new Contact(props);

    contact.addDomainEvent({
      type: 'crm.ContactCreated',
      data: {
        organizationId: Number(props.organizationId),
        contactId: Number(props.id), // TODO: standardized ID types
        email: props.email ?? undefined,
        phone: props.phone ?? undefined,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'crm',
        timestamp: new Date().toISOString(),
        correlationId: props.id,
        tenantContext: { organizationId: Number(props.organizationId) },
      },
    });

    return contact;
  }

  static reconstitute(props: ContactProps): Contact {
    return new Contact(ContactPropsSchema.parse(props));
  }

  // ---- Accessors ----

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
      this.props.customFields = {
        ...this.props.customFields,
        ...input.customFields,
      };
    }
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      type: 'crm.ContactUpdated',
      data: {
        organizationId: Number(this.props.organizationId),
        contactId: Number(this.props.id),
        fields: Object.keys(input),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'crm',
        timestamp: new Date().toISOString(),
        correlationId: this.props.id,
        tenantContext: { organizationId: Number(this.props.organizationId) },
      },
    });
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

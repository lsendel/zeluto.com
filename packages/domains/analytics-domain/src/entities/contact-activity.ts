import { AggregateRoot } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const ContactActivityPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  eventType: z.string().min(1),
  eventSource: z.string().optional().nullable(),
  eventData: z.record(z.string(), z.unknown()).optional().nullable(),
  createdAt: z.coerce.date(),
});

export type ContactActivityProps = z.infer<typeof ContactActivityPropsSchema>;

export class ContactActivity extends AggregateRoot<ContactActivityProps> {
  private constructor(props: ContactActivityProps) {
    super(props.id, props);
  }

  static create(input: {
    id?: string;
    organizationId: string;
    contactId: string;
    eventType: string;
    eventSource?: string | null;
    eventData?: Record<string, unknown> | null;
    createdAt?: Date;
  }): ContactActivity {
    const props = ContactActivityPropsSchema.parse({
      id: input.id ?? crypto.randomUUID(),
      organizationId: input.organizationId,
      contactId: input.contactId,
      eventType: input.eventType,
      eventSource: input.eventSource ?? null,
      eventData: input.eventData ?? null,
      createdAt: input.createdAt ?? new Date(),
    });

    return new ContactActivity(props);
  }

  static reconstitute(props: ContactActivityProps): ContactActivity {
    return new ContactActivity(ContactActivityPropsSchema.parse(props));
  }

  get organizationId() {
    return this.props.organizationId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get eventType() {
    return this.props.eventType;
  }
  get eventSource() {
    return this.props.eventSource;
  }
  get eventData() {
    return this.props.eventData;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  toProps(): Readonly<ContactActivityProps> {
    return Object.freeze({ ...this.props });
  }
}

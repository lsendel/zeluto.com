import { z } from 'zod';

export const AnalyticsEventPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  eventType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string(),
  contactId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
});

export type AnalyticsEventProps = z.infer<typeof AnalyticsEventPropsSchema>;

export class AnalyticsEvent {
  private constructor(private props: AnalyticsEventProps) {}

  static create(input: {
    organizationId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    contactId?: string | null;
    metadata?: Record<string, unknown>;
  }): AnalyticsEvent {
    return new AnalyticsEvent(
      AnalyticsEventPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        contactId: input.contactId ?? null,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: AnalyticsEventProps): AnalyticsEvent {
    return new AnalyticsEvent(AnalyticsEventPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get eventType(): string {
    return this.props.eventType;
  }
  get entityType(): string {
    return this.props.entityType;
  }
  get entityId(): string {
    return this.props.entityId;
  }
  get contactId(): string | null {
    return this.props.contactId;
  }
  get metadata(): Record<string, unknown> {
    return this.props.metadata;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toProps(): Readonly<AnalyticsEventProps> {
    return Object.freeze({ ...this.props });
  }
}

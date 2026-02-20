import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const ChannelSchema = z.enum(['email', 'sms', 'push', 'webhook']);
export type Channel = z.infer<typeof ChannelSchema>;

export const DeliveryJobStatusSchema = z.enum([
  'queued',
  'sending',
  'sent',
  'failed',
  'partial',
]);
export type DeliveryJobStatus = z.infer<typeof DeliveryJobStatusSchema>;

export const DeliveryJobPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  channel: ChannelSchema,
  status: DeliveryJobStatusSchema,
  recipientCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});

export type DeliveryJobProps = z.infer<typeof DeliveryJobPropsSchema>;

export class DeliveryJob {
  private constructor(private props: DeliveryJobProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    channel: Channel;
    recipientCount: number;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): DeliveryJob {
    if (!input.idempotencyKey || input.idempotencyKey.trim().length === 0) {
      throw new InvariantViolation('idempotencyKey is required');
    }

    return new DeliveryJob(
      DeliveryJobPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        channel: input.channel,
        status: 'queued',
        recipientCount: input.recipientCount,
        sentCount: 0,
        failedCount: 0,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata ?? null,
        createdAt: new Date(),
        completedAt: null,
      }),
    );
  }

  static reconstitute(props: DeliveryJobProps): DeliveryJob {
    return new DeliveryJob(DeliveryJobPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get channel(): Channel {
    return this.props.channel;
  }
  get status(): DeliveryJobStatus {
    return this.props.status;
  }
  get recipientCount(): number {
    return this.props.recipientCount;
  }
  get sentCount(): number {
    return this.props.sentCount;
  }
  get failedCount(): number {
    return this.props.failedCount;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get metadata(): Record<string, unknown> | null {
    return this.props.metadata;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  // ---- Domain methods ----

  markSending(): void {
    if (this.props.status !== 'queued') {
      throw new InvariantViolation(
        `Cannot mark job as sending from status "${this.props.status}"`,
      );
    }
    this.props.status = 'sending';
  }

  recordSuccess(): void {
    if (this.props.status !== 'sending') {
      throw new InvariantViolation(
        `Cannot record success when job status is "${this.props.status}"`,
      );
    }
    this.props.sentCount += 1;
  }

  recordFailure(): void {
    if (this.props.status !== 'sending') {
      throw new InvariantViolation(
        `Cannot record failure when job status is "${this.props.status}"`,
      );
    }
    this.props.failedCount += 1;
  }

  complete(): void {
    if (this.props.status !== 'sending') {
      throw new InvariantViolation(
        `Cannot complete job from status "${this.props.status}"`,
      );
    }

    if (this.props.failedCount === this.props.recipientCount) {
      this.props.status = 'failed';
    } else if (this.props.failedCount > 0) {
      this.props.status = 'partial';
    } else {
      this.props.status = 'sent';
    }

    this.props.completedAt = new Date();
  }

  isComplete(): boolean {
    return (
      this.props.sentCount + this.props.failedCount >= this.props.recipientCount
    );
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<DeliveryJobProps> {
    return Object.freeze({ ...this.props });
  }
}

import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';
import { ChannelSchema, type Channel } from './delivery-job.js';

export const ProviderTypeSchema = z.enum([
  'ses',
  'sendgrid',
  'twilio',
  'postmark',
  'custom_smtp',
  'fcm',
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const ProviderConfigPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  channel: ChannelSchema,
  providerType: ProviderTypeSchema,
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  priority: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProviderConfigProps = z.infer<typeof ProviderConfigPropsSchema>;

export class ProviderConfig {
  private constructor(private props: ProviderConfigProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    channel: Channel;
    providerType: ProviderType;
    config: Record<string, unknown>;
    priority?: number;
  }): ProviderConfig {
    return new ProviderConfig(
      ProviderConfigPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        channel: input.channel,
        providerType: input.providerType,
        config: input.config,
        isActive: true,
        priority: input.priority ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ProviderConfigProps): ProviderConfig {
    return new ProviderConfig(ProviderConfigPropsSchema.parse(props));
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
  get providerType(): ProviderType {
    return this.props.providerType;
  }
  get config(): Record<string, unknown> {
    return this.props.config;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get priority(): number {
    return this.props.priority;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  activate(): void {
    if (this.props.isActive) {
      throw new InvariantViolation('Provider config is already active');
    }
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    if (!this.props.isActive) {
      throw new InvariantViolation('Provider config is already inactive');
    }
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  updateConfig(config: Record<string, unknown>): void {
    this.props.config = config;
    this.props.updatedAt = new Date();
  }

  updatePriority(priority: number): void {
    if (priority < 0) {
      throw new InvariantViolation('Priority must be a non-negative integer');
    }
    this.props.priority = priority;
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<ProviderConfigProps> {
    return Object.freeze({ ...this.props });
  }
}

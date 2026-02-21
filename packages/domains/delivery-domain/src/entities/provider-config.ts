import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';
import { type Channel, ChannelSchema } from './delivery-job.js';

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

/**
 * Maps each provider type to the channels it supports.
 */
const PROVIDER_CHANNEL_MAP: Record<ProviderType, readonly Channel[]> = {
  ses: ['email'],
  sendgrid: ['email'],
  postmark: ['email'],
  custom_smtp: ['email'],
  twilio: ['sms'],
  fcm: ['push'],
};

/**
 * Required config keys per provider type.
 */
const PROVIDER_REQUIRED_CONFIG: Record<ProviderType, readonly string[]> = {
  ses: ['region', 'accessKeyId', 'secretAccessKey'],
  sendgrid: ['apiKey'],
  postmark: ['serverToken'],
  custom_smtp: ['host', 'port', 'username', 'password'],
  twilio: ['accountSid', 'authToken', 'fromNumber'],
  fcm: ['projectId', 'serviceAccountKey'],
};

export function validateChannelCompatibility(
  channel: Channel,
  providerType: ProviderType,
): void {
  const allowed = PROVIDER_CHANNEL_MAP[providerType];
  if (!allowed.includes(channel)) {
    throw new InvariantViolation(
      `Provider type '${providerType}' does not support channel '${channel}'. Supported channels: ${allowed.join(', ')}`,
    );
  }
}

export function validateProviderConfig(
  providerType: ProviderType,
  config: Record<string, unknown>,
): void {
  const required = PROVIDER_REQUIRED_CONFIG[providerType];
  const missing = required.filter((key) => !(key in config) || config[key] == null || config[key] === '');
  if (missing.length > 0) {
    throw new InvariantViolation(
      `Provider type '${providerType}' requires config keys: ${missing.join(', ')}`,
    );
  }
}

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
    validateChannelCompatibility(input.channel, input.providerType);
    validateProviderConfig(input.providerType, input.config);

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
    validateProviderConfig(this.props.providerType, config);
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

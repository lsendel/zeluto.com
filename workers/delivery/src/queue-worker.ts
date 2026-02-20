import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type {
  Channel,
  DeliveryPipelineInput,
  FcmProviderConfig,
  ProviderConfigRepository,
  ProviderType,
  SendGridProviderConfig,
  SesProviderConfig,
  SuppressionRepository,
  TwilioProviderConfig,
} from '@mauntic/delivery-domain';
import {
  DeliveryPipeline,
  decryptConfig,
  FcmProvider,
  ProviderConfig,
  ProviderResolver,
  SendGridProvider,
  SesProvider,
  TwilioProvider,
} from '@mauntic/delivery-domain';
import type { DeliveryProvider } from '@mauntic/domain-kernel';
import {
  createDatabase,
  createLoggerFromEnv,
  logQueueMetric,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  findActiveProvidersByChannel,
  isEmailSuppressed,
} from './infrastructure/repositories/index.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface DeliveryQueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  ENCRYPTION_KEY: string;
  TENANT_CACHE?: DurableObjectNamespace;
  LOGS_DATASET?: AnalyticsEngineDataset;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type DeliveryJobType = 'delivery.SendMessage' | 'delivery.RetryMessage';

export interface SendMessageData {
  organizationId: string;
  channel: 'email' | 'sms' | 'push' | 'webhook';
  recipient: string;
  from: string;
  subject?: string;
  body: string;
  text?: string;
  idempotencyKey?: string;
}

export interface DeliveryJobMessage {
  type: DeliveryJobType;
  data: SendMessageData;
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Adapter: SuppressionRepository backed by Drizzle helper functions
// ---------------------------------------------------------------------------

class DrizzleSuppressionAdapter implements SuppressionRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async isBlocked(orgId: string, email: string): Promise<boolean> {
    const result = await isEmailSuppressed(this.db, orgId, email);
    return result.suppressed;
  }

  /* The remaining methods are not needed for the queue pipeline. */
  async findById() {
    return null;
  }
  async findByOrganization() {
    return { data: [], total: 0 };
  }
  async save() {
    /* no-op */
  }
  async delete() {
    /* no-op */
  }
}

// ---------------------------------------------------------------------------
// Adapter: ProviderConfigRepository backed by Drizzle helper functions
// ---------------------------------------------------------------------------

class DrizzleProviderConfigAdapter implements ProviderConfigRepository {
  constructor(
    private readonly db: NeonHttpDatabase,
    readonly _encryptionKey: string,
  ) {}

  async findActiveByOrgAndChannel(
    orgId: string,
    channel: Channel,
  ): Promise<ProviderConfig[]> {
    const rows = await findActiveProvidersByChannel(this.db, orgId, channel);
    if (rows.length === 0) return [];

    const entities: ProviderConfig[] = [];
    for (const row of rows) {
      try {
        entities.push(await this.rowToEntity(row));
      } catch (error) {
        console.error(
          {
            providerConfigId: row.id,
            organizationId: orgId,
            channel,
            error,
          },
          'Skipping invalid provider config',
        );
      }
    }

    return entities;
  }

  /* The remaining methods are not needed for the queue pipeline. */
  async findById() {
    return null;
  }
  async findByOrganization() {
    return [];
  }
  async save() {
    /* no-op */
  }
  async delete() {
    /* no-op */
  }

  private async rowToEntity(
    row: Awaited<ReturnType<typeof findActiveProvidersByChannel>>[number],
  ): Promise<ProviderConfig> {
    const r = row as Record<string, unknown>;
    const config = await this.decodeConfig(r.config);

    return ProviderConfig.reconstitute({
      id: r.id as string,
      organizationId: r.organization_id as string,
      channel: r.channel as Channel,
      providerType: r.provider_type as ProviderType,
      config,
      isActive: r.is_active as boolean,
      priority: r.priority as number,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    });
  }

  private async decodeConfig(raw: unknown): Promise<Record<string, unknown>> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }

    if (typeof raw === 'string') {
      if (looksEncryptedConfig(raw)) {
        const decryptedString = await decryptConfig(raw, this._encryptionKey);
        const parsed = JSON.parse(decryptedString) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } else {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      }
    }

    throw new Error('Provider config must be a JSON object');
  }
}

function looksEncryptedConfig(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  return parts.every((part) => /^[A-Za-z0-9+/=_-]+$/.test(part));
}

// ---------------------------------------------------------------------------
// DeliveryProvider factory
// ---------------------------------------------------------------------------

/**
 * Creates a DeliveryProvider adapter from a ProviderConfig entity.
 *
 * Instantiates concrete providers from persisted provider configuration.
 * Unsupported provider types intentionally throw, so fallback providers
 * can be attempted by the delivery pipeline.
 */
function createProviderFromConfig(
  config: ProviderConfig,
): DeliveryProvider<Channel> {
  switch (config.providerType) {
    case 'sendgrid': {
      if (config.channel !== 'email') {
        throw new Error('SendGrid provider can only be used for email channel');
      }
      const providerConfig: SendGridProviderConfig = {
        apiKey: readRequiredString(config.config, ['apiKey', 'api_key']),
      };
      return new SendGridProvider(providerConfig);
    }

    case 'ses': {
      if (config.channel !== 'email') {
        throw new Error('SES provider can only be used for email channel');
      }
      const providerConfig: SesProviderConfig = {
        region: readRequiredString(config.config, ['region']),
        accessKeyId: readRequiredString(config.config, [
          'accessKeyId',
          'access_key_id',
        ]),
        secretAccessKey: readRequiredString(config.config, [
          'secretAccessKey',
          'secret_access_key',
        ]),
      };
      return new SesProvider(providerConfig);
    }

    case 'twilio': {
      if (config.channel !== 'sms') {
        throw new Error('Twilio provider can only be used for sms channel');
      }
      const providerConfig: TwilioProviderConfig = {
        accountSid: readRequiredString(config.config, [
          'accountSid',
          'account_sid',
        ]),
        authToken: readRequiredString(config.config, [
          'authToken',
          'auth_token',
        ]),
        fromNumber: readRequiredString(config.config, [
          'fromNumber',
          'from_number',
        ]),
      };
      return new TwilioProvider(providerConfig);
    }

    case 'fcm': {
      if (config.channel !== 'push') {
        throw new Error('FCM provider can only be used for push channel');
      }
      const serviceAccountRaw = readRequiredValue(config.config, [
        'serviceAccountKey',
        'service_account_key',
      ]);
      const providerConfig: FcmProviderConfig = {
        projectId: readRequiredString(config.config, [
          'projectId',
          'project_id',
        ]),
        serviceAccountKey:
          typeof serviceAccountRaw === 'string'
            ? serviceAccountRaw
            : JSON.stringify(serviceAccountRaw),
      };
      return new FcmProvider(providerConfig);
    }

    case 'postmark':
    case 'custom_smtp':
      throw new Error(
        `Provider type "${config.providerType}" is not supported in delivery queue worker`,
      );

    default:
      throw new Error(`Unknown provider type: ${String(config.providerType)}`);
  }
}

function readRequiredString(
  config: Record<string, unknown>,
  keys: string[],
): string {
  const value = readRequiredValue(config, keys);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Provider config "${keys.join('/')}" must be a string`);
  }
  return value.trim();
}

function readRequiredValue(
  config: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (key in config) {
      const value = config[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  throw new Error(`Missing provider config key: ${keys.join('/')}`);
}

// ---------------------------------------------------------------------------
// Queue handler
// ---------------------------------------------------------------------------

export async function queue(
  batch: MessageBatch,
  env: DeliveryQueueEnv,
): Promise<void> {
  const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
  const queueName = batch.queue ?? 'mauntic-delivery-events';
  const baseLogger = createLoggerFromEnv(
    'delivery-queue',
    env as unknown as Record<string, unknown>,
    {
      requestId: batch.messages[0]?.id ?? crypto.randomUUID(),
      baseFields: { queue: queueName },
    },
  );

  // Build pipeline dependencies once per batch
  const suppressionRepo = new DrizzleSuppressionAdapter(db);
  const providerConfigRepo = new DrizzleProviderConfigAdapter(
    db,
    env.ENCRYPTION_KEY,
  );
  const providerResolver = new ProviderResolver(providerConfigRepo);
  const pipeline = new DeliveryPipeline({
    suppressionRepo,
    providerResolver,
    createProvider: (config: ProviderConfig) =>
      createProviderFromConfig(config),
  });

  for (const message of batch.messages) {
    const startedAt = Date.now();
    const job = normalizeMessage(message.body);

    if (!job) {
      message.ack();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: 'delivery.unknown',
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    const messageLogger = baseLogger.child({
      messageId: message.id,
      jobType: job.type,
      organizationId: job.data.organizationId,
      channel: job.data.channel,
    });

    // Idempotency check via KV
    const idempotencyKey = job.data.idempotencyKey ?? message.id;
    const kvKey = `delivery-queue:${idempotencyKey}`;
    const existing = await env.KV.get(kvKey);
    if (existing) {
      message.ack();
      const durationMs = Date.now() - startedAt;
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: job.type,
        durationMs,
      });
      messageLogger.info(
        { durationMs, event: 'queue.dedup.skip' },
        'Duplicate message skipped',
      );
      continue;
    }

    try {
      const input: DeliveryPipelineInput = {
        organizationId: job.data.organizationId,
        channel: job.data.channel,
        recipient: job.data.recipient,
        from: job.data.from,
        subject: job.data.subject,
        body: job.data.body,
        text: job.data.text,
      };

      const result = await pipeline.execute(input);

      if (!result.success) {
        throw new Error(result.error ?? 'Pipeline execution failed');
      }

      // Mark as processed for idempotency (TTL 24h)
      await env.KV.put(kvKey, JSON.stringify({ messageId: result.messageId }), {
        expirationTtl: 86_400,
      });

      const durationMs = Date.now() - startedAt;
      message.ack();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: job.type,
        durationMs,
      });
      messageLogger.info(
        {
          durationMs,
          externalId: result.messageId,
          event: 'queue.job.success',
        },
        'Delivery message sent',
      );
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      message.retry();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'retry',
        eventType: job.type,
        durationMs,
      });
      messageLogger.error(
        {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          event: 'queue.job.failure',
        },
        'Delivery message failed',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Message normalization
// ---------------------------------------------------------------------------

function normalizeMessage(body: unknown): DeliveryJobMessage | null {
  if (!body) return null;

  let candidate: Record<string, unknown> | null = null;

  if (typeof body === 'string') {
    try {
      candidate = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof body === 'object') {
    candidate = body as Record<string, unknown>;
  }

  if (!candidate) return null;

  const type = candidate.type as string | undefined;
  if (type !== 'delivery.SendMessage' && type !== 'delivery.RetryMessage') {
    return null;
  }

  const data = candidate.data as Record<string, unknown> | undefined;
  if (
    !data ||
    typeof data.organizationId !== 'string' ||
    typeof data.channel !== 'string'
  ) {
    return null;
  }

  return {
    type,
    data: {
      organizationId: data.organizationId as string,
      channel: data.channel as 'email' | 'sms' | 'push' | 'webhook',
      recipient: (data.recipient as string) ?? '',
      from: (data.from as string) ?? '',
      subject: data.subject as string | undefined,
      body: (data.body as string) ?? '',
      text: data.text as string | undefined,
      idempotencyKey: data.idempotencyKey as string | undefined,
    },
    correlationId:
      typeof candidate.correlationId === 'string'
        ? candidate.correlationId
        : undefined,
  };
}

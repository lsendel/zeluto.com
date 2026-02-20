import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type {
  Channel,
  DeliveryPipelineInput,
  ProviderConfigRepository,
  SuppressionRepository,
} from '@mauntic/delivery-domain';
import {
  DeliveryPipeline,
  ProviderConfig,
  ProviderResolver,
} from '@mauntic/delivery-domain';
import type { DeliveryProvider } from '@mauntic/domain-kernel';
import {
  createDatabase,
  createLoggerFromEnv,
  logQueueMetric,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  findActiveProviderByChannel,
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
    const row = await findActiveProviderByChannel(this.db, orgId, channel);
    if (!row) return [];
    return [this.rowToEntity(row)];
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

  private rowToEntity(
    row: NonNullable<Awaited<ReturnType<typeof findActiveProviderByChannel>>>,
  ): ProviderConfig {
    const r = row as Record<string, unknown>;
    return ProviderConfig.reconstitute({
      id: r.id as string,
      organizationId: r.organization_id as string,
      channel: r.channel as Channel,
      providerType: r.provider_type as any,
      config: (r.config ?? {}) as Record<string, unknown>,
      isActive: r.is_active as boolean,
      priority: r.priority as number,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    });
  }
}

// ---------------------------------------------------------------------------
// Stub DeliveryProvider factory
// ---------------------------------------------------------------------------

/**
 * Creates a DeliveryProvider adapter from a ProviderConfig entity.
 *
 * For now this decrypts the stored config and builds a lightweight stub that
 * calls the provider. Real provider adapters (SES, SendGrid, etc.) will be
 * wired in when we implement provider integrations end-to-end.
 */
function createProviderFromConfig(
  _config: ProviderConfig,
  _encryptionKey: string,
): DeliveryProvider<Channel> {
  return {
    channel: _config.channel,
    name: _config.providerType,
    async send(_payload) {
      // TODO: wire real provider adapters (SES, SendGrid, Twilio, FCM, etc.)
      // For now return a stub success so the pipeline can be tested end-to-end.
      return {
        success: true,
        externalId: `stub-${crypto.randomUUID()}`,
      };
    },
  };
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
      createProviderFromConfig(config, env.ENCRYPTION_KEY),
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

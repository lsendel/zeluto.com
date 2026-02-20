import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type {
  EnrichmentProviderAdapter,
  EnrichmentRequest,
} from '@mauntic/lead-intelligence-domain';
import {
  EnrichmentJob,
  EnrichmentOrchestrator,
  ProviderHealth,
} from '@mauntic/lead-intelligence-domain';
import {
  createDatabase,
  createLoggerFromEnv,
  logQueueMetric,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  ApolloAdapter,
  ClearbitAdapter,
  HunterAdapter,
  LushaAdapter,
  RocketReachAdapter,
  ZoomInfoAdapter,
} from './adapters/index.js';
import {
  DrizzleEnrichmentCacheRepository,
  DrizzleProviderHealthRepository,
  DrizzleWaterfallConfigRepository,
} from './application/domain-adapters.js';
import { deleteExpiredCache } from './infrastructure/repositories/enrichment-cache-repository.js';
import {
  findJobById,
  updateJob,
} from './infrastructure/repositories/enrichment-job-repository.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

interface LeadIntelligenceQueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  TENANT_CACHE?: DurableObjectNamespace;
  LOGS_DATASET?: AnalyticsEngineDataset;
  // Provider API keys (set via wrangler secret put)
  CLEARBIT_API_KEY?: string;
  APOLLO_API_KEY?: string;
  HUNTER_API_KEY?: string;
  ZOOMINFO_API_KEY?: string;
  ROCKETREACH_API_KEY?: string;
  LUSHA_API_KEY?: string;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

type LeadIntelligenceEventType =
  | 'enrichment.JobCreated'
  | 'enrichment.BatchCreated'
  | 'enrichment.CacheCleanup'
  | 'enrichment.HealthCheck';

interface LeadIntelligenceEvent {
  type: LeadIntelligenceEventType;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeMessage(body: unknown): LeadIntelligenceEvent | null {
  if (!body) return null;

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as LeadIntelligenceEvent;
      return parsed?.type ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    const candidate = body as Record<string, unknown>;
    if (typeof candidate.type === 'string') {
      return {
        type: candidate.type as LeadIntelligenceEventType,
        data: (candidate.data as Record<string, unknown>) ?? {},
      };
    }
  }

  return null;
}

/**
 * Build the adapter map from available API keys in the environment.
 * Only adapters whose API keys are present will be included.
 */
function buildAdapterMap(
  env: LeadIntelligenceQueueEnv,
): Map<string, EnrichmentProviderAdapter> {
  const adapters = new Map<string, EnrichmentProviderAdapter>();

  if (env.CLEARBIT_API_KEY)
    adapters.set('clearbit', new ClearbitAdapter(env.CLEARBIT_API_KEY));
  if (env.APOLLO_API_KEY)
    adapters.set('apollo', new ApolloAdapter(env.APOLLO_API_KEY));
  if (env.HUNTER_API_KEY)
    adapters.set('hunter', new HunterAdapter(env.HUNTER_API_KEY));
  if (env.ZOOMINFO_API_KEY)
    adapters.set('zoominfo', new ZoomInfoAdapter(env.ZOOMINFO_API_KEY));
  if (env.ROCKETREACH_API_KEY)
    adapters.set(
      'rocketreach',
      new RocketReachAdapter(env.ROCKETREACH_API_KEY),
    );
  if (env.LUSHA_API_KEY)
    adapters.set('lusha', new LushaAdapter(env.LUSHA_API_KEY));

  return adapters;
}

/**
 * Reconstitute an EnrichmentJob entity from its DB row.
 */
function reconstituteJob(row: {
  id: string;
  organization_id: string;
  contact_id: string;
  status: string;
  field_requests: string[];
  results: Array<{
    field: string;
    provider: string;
    value: unknown;
    confidence: number;
    cost: number;
    latencyMs: number;
  }> | null;
  total_cost: string | null;
  total_latency_ms: number | null;
  providers_tried: string[] | null;
  error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}): EnrichmentJob {
  return EnrichmentJob.reconstitute({
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    status: row.status as
      | 'pending'
      | 'running'
      | 'completed'
      | 'failed'
      | 'exhausted',
    fieldRequests: row.field_requests,
    results: row.results ?? [],
    totalCost: row.total_cost ? Number(row.total_cost) : 0,
    totalLatencyMs: row.total_latency_ms ?? 0,
    providersTried: row.providers_tried ?? [],
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  });
}

/**
 * Persist the mutated EnrichmentJob entity back to the database.
 */
async function persistJob(
  db: NeonHttpDatabase,
  job: EnrichmentJob,
): Promise<void> {
  const props = job.toProps();
  await updateJob(db, props.id, {
    status: props.status,
    results: props.results,
    total_cost: String(props.totalCost),
    total_latency_ms: props.totalLatencyMs,
    providers_tried: props.providersTried,
    error: props.error,
    started_at: props.startedAt,
    completed_at: props.completedAt,
  });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleJobCreated(
  db: NeonHttpDatabase,
  env: LeadIntelligenceQueueEnv,
  data: {
    jobId: string;
    organizationId: string;
    contactId: string;
    contactData: EnrichmentRequest;
  },
): Promise<void> {
  const row = await findJobById(db, data.jobId);
  if (!row) {
    throw new Error(`Enrichment job not found: ${data.jobId}`);
  }

  const job = reconstituteJob(row);
  const adapters = buildAdapterMap(env);
  const cache = new DrizzleEnrichmentCacheRepository(db);
  const health = new DrizzleProviderHealthRepository(db);
  const waterfallConfig = new DrizzleWaterfallConfigRepository(db);

  const orchestrator = new EnrichmentOrchestrator({
    adapters,
    cache,
    health,
    waterfallConfig,
  });
  await orchestrator.execute(data.organizationId, job, data.contactData);
  await persistJob(db, job);
}

async function handleBatchCreated(
  db: NeonHttpDatabase,
  env: LeadIntelligenceQueueEnv,
  data: { jobIds: string[]; organizationId: string },
): Promise<void> {
  for (const jobId of data.jobIds) {
    const row = await findJobById(db, jobId);
    if (!row) continue;

    await env.EVENTS.send({
      type: 'enrichment.JobCreated',
      data: {
        jobId: row.id,
        organizationId: data.organizationId,
        contactId: row.contact_id,
        contactData: { contactId: row.contact_id } as EnrichmentRequest,
      },
    });
  }
}

async function handleCacheCleanup(db: NeonHttpDatabase): Promise<number> {
  return deleteExpiredCache(db);
}

async function handleHealthCheck(
  db: NeonHttpDatabase,
  env: LeadIntelligenceQueueEnv,
  data: { organizationId?: string },
): Promise<void> {
  const adapters = buildAdapterMap(env);
  const healthRepo = new DrizzleProviderHealthRepository(db);
  const orgId = data.organizationId ?? '00000000-0000-0000-0000-000000000000';

  for (const [providerId, adapter] of adapters) {
    try {
      const isHealthy = await adapter.healthCheck();
      let health = await healthRepo.findByProvider(orgId, providerId);
      if (!health) {
        health = ProviderHealth.create(orgId, providerId);
      }

      if (isHealthy) {
        health.recordSuccess();
      } else {
        health.recordFailure();
      }

      await healthRepo.save(health);
    } catch {
      // If the health check itself throws, record a failure
      let health = await healthRepo.findByProvider(orgId, providerId);
      if (!health) {
        health = ProviderHealth.create(orgId, providerId);
      }
      health.recordFailure();
      await healthRepo.save(health);
    }
  }
}

// ---------------------------------------------------------------------------
// Queue consumer
// ---------------------------------------------------------------------------

async function queue(
  batch: MessageBatch,
  env: LeadIntelligenceQueueEnv,
): Promise<void> {
  const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
  const queueName = batch.queue ?? 'mauntic-lead-intelligence-events';
  const baseLogger = createLoggerFromEnv(
    'lead-intelligence-queue',
    env as unknown as Record<string, unknown>,
    {
      requestId: batch.messages[0]?.id ?? crypto.randomUUID(),
      baseFields: { queue: queueName },
    },
  );

  for (const msg of batch.messages) {
    const startedAt = Date.now();
    const event = normalizeMessage(msg.body);

    if (!event) {
      msg.ack();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'ack',
        eventType: 'unknown',
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    const messageLogger = baseLogger.child({
      messageId: msg.id,
      eventType: event.type,
    });

    // Idempotency check via KV
    const dedupeKey = `li-queue:${msg.id}`;
    const existing = await env.KV.get(dedupeKey);
    if (existing) {
      msg.ack();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'duplicate',
        eventType: event.type,
      });
      messageLogger.info(
        { event: 'queue.message.duplicate' },
        'Duplicate message skipped',
      );
      continue;
    }

    try {
      switch (event.type) {
        case 'enrichment.JobCreated': {
          const data = event.data as {
            jobId: string;
            organizationId: string;
            contactId: string;
            contactData: EnrichmentRequest;
          };
          await handleJobCreated(db, env, data);
          break;
        }

        case 'enrichment.BatchCreated': {
          const data = event.data as {
            jobIds: string[];
            organizationId: string;
          };
          await handleBatchCreated(db, env, data);
          break;
        }

        case 'enrichment.CacheCleanup': {
          const deleted = await handleCacheCleanup(db);
          messageLogger.info(
            { deleted, event: 'queue.cache.cleanup' },
            'Cache cleanup completed',
          );
          break;
        }

        case 'enrichment.HealthCheck': {
          const data = event.data as { organizationId?: string };
          await handleHealthCheck(db, env, data);
          messageLogger.info(
            { event: 'queue.health.check' },
            'Health check completed',
          );
          break;
        }

        default: {
          messageLogger.warn(
            { event: 'queue.unknown_event' },
            `Unknown event type: ${event.type}`,
          );
          break;
        }
      }

      // Mark as processed for idempotency (24h TTL)
      await env.KV.put(dedupeKey, '1', { expirationTtl: 86400 });
      msg.ack();

      const durationMs = Date.now() - startedAt;
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'ack',
        eventType: event.type,
        durationMs,
      });
      messageLogger.info({ durationMs, event: 'queue.job.success' });
    } catch (error) {
      msg.retry();

      const durationMs = Date.now() - startedAt;
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'retry',
        eventType: event.type,
        durationMs,
      });
      messageLogger.error(
        {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          event: 'queue.job.failure',
        },
        'Lead intelligence queue job failed',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Scheduled handler (cron triggers)
// ---------------------------------------------------------------------------

async function scheduled(
  event: ScheduledEvent,
  env: LeadIntelligenceQueueEnv,
): Promise<void> {
  if (event.cron === '0 4 * * *') {
    await env.EVENTS.send({ type: 'enrichment.CacheCleanup', data: {} });
  }
  if (event.cron === '*/15 * * * *') {
    await env.EVENTS.send({ type: 'enrichment.HealthCheck', data: {} });
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default {
  queue,
  scheduled,
};

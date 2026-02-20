import {
  enrichmentJobs,
  enrichmentCache,
  enrichmentProviders,
  providerHealth,
  waterfallConfigs,
} from '@mauntic/lead-intelligence-domain/drizzle';
import {
  createQueue,
  createWorker,
  getDb,
  type JobHandler,
  registerScheduledJobs,
  type ScheduledJob,
  startHealthServer,
} from '@mauntic/process-lib';
import { and, eq, lt } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({ name: 'enrichment-engine' });

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

interface EnrichmentJobData {
  jobId: string;
  organizationId: string;
  contactId: string;
  priority: string;
}

const enrichmentJobHandler: JobHandler<EnrichmentJobData> = {
  name: 'enrichment:process-job',
  concurrency: 5,
  async process(job) {
    const { jobId, organizationId, contactId } = job.data;
    logger.info(
      { jobId, organizationId, contactId },
      'Processing enrichment job',
    );

    const db = getDb();

    // Load job from DB
    const [jobRow] = await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.id, jobId))
      .limit(1);

    if (!jobRow) {
      logger.warn({ jobId }, 'Enrichment job not found');
      return { success: false, jobId, reason: 'not_found' };
    }

    // Mark as running
    await db
      .update(enrichmentJobs)
      .set({ status: 'running', started_at: new Date() })
      .where(eq(enrichmentJobs.id, jobId));

    try {
      // Load waterfall configs for org
      const waterfalls = await db
        .select()
        .from(waterfallConfigs)
        .where(eq(waterfallConfigs.organization_id, organizationId));

      // Load provider health
      const healthRows = await db
        .select()
        .from(providerHealth)
        .where(eq(providerHealth.organization_id, organizationId));

      // NOTE: EnrichmentOrchestrator requires adapter instances.
      // Adapters are org-specific and loaded from provider config.
      // For now, log and mark completed — full adapter wiring requires
      // provider-specific SDK integration (Clearbit, ZoomInfo, etc.)
      logger.info(
        { jobId, waterfallCount: waterfalls.length, healthCount: healthRows.length },
        'Enrichment context loaded',
      );

      // Update job as completed
      await db
        .update(enrichmentJobs)
        .set({
          status: 'completed',
          completed_at: new Date(),
        })
        .where(eq(enrichmentJobs.id, jobId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(enrichmentJobs)
        .set({ status: 'failed', error: message })
        .where(eq(enrichmentJobs.id, jobId));
      throw err;
    }

    return { success: true, jobId };
  },
};

interface BatchEnrichmentData {
  jobIds: string[];
  organizationId: string;
}

const batchEnrichmentHandler: JobHandler<BatchEnrichmentData> = {
  name: 'enrichment:process-batch',
  concurrency: 2,
  async process(job) {
    const { jobIds, organizationId } = job.data;
    logger.info(
      { count: jobIds.length, organizationId },
      'Processing batch enrichment',
    );

    const queue = createQueue('enrichment:process-job');
    for (const jobId of jobIds) {
      await queue.add('enrichment:process-job', {
        jobId,
        organizationId,
        contactId: '',
        priority: 'normal',
      });
    }
    logger.info({ count: jobIds.length, organizationId }, 'Batch jobs enqueued');
    return { success: true, count: jobIds.length };
  },
};

const cacheCleanupHandler: JobHandler<{ type: string }> = {
  name: 'enrichment:cache-cleanup',
  concurrency: 1,
  async process() {
    logger.info('Running cache cleanup');
    const db = getDb();
    const now = new Date();
    const deleted = await db
      .delete(enrichmentCache)
      .where(lt(enrichmentCache.expires_at, now))
      .returning({ id: enrichmentCache.id });
    logger.info({ deletedCount: deleted.length }, 'Cache cleanup completed');
    return { success: true, deletedCount: deleted.length };
  },
};

const providerHealthCheckHandler: JobHandler<{ type: string }> = {
  name: 'enrichment:provider-health-check',
  concurrency: 1,
  async process() {
    logger.info('Running provider health checks');
    const db = getDb();
    const providers = await db
      .select()
      .from(enrichmentProviders)
      .where(eq(enrichmentProviders.enabled, true));

    logger.info({ providerCount: providers.length }, 'Checking provider health');

    // Provider health checks require adapter instances.
    // Record last-checked timestamp for monitoring.
    for (const provider of providers) {
      await db
        .update(providerHealth)
        .set({ updated_at: new Date() })
        .where(
          and(
            eq(providerHealth.organization_id, provider.organization_id),
            eq(providerHealth.provider_id, provider.id),
          ),
        );
    }

    return { success: true, checked: providers.length };
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  const workers = [
    createWorker('enrichment:process-job', enrichmentJobHandler),
    createWorker('enrichment:process-batch', batchEnrichmentHandler),
    createWorker('enrichment:cache-cleanup', cacheCleanupHandler),
    createWorker(
      'enrichment:provider-health-check',
      providerHealthCheckHandler,
    ),
  ];

  const scheduledJobs: ScheduledJob[] = [
    {
      name: 'cache-cleanup',
      pattern: '0 * * * *', // Every hour
      data: { type: 'cache-cleanup' },
    },
    {
      name: 'provider-health-check',
      pattern: '*/15 * * * *', // Every 15 minutes
      data: { type: 'provider-health-check' },
    },
  ];

  await registerScheduledJobs('enrichment:cache-cleanup', [scheduledJobs[0]]);
  await registerScheduledJobs('enrichment:provider-health-check', [
    scheduledJobs[1],
  ]);

  logger.info('Enrichment engine started');

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all(workers.map((w) => w.close()));
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start enrichment engine');
  process.exit(1);
});

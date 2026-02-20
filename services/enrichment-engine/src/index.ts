import {
  createWorker,
  type JobHandler,
  registerScheduledJobs,
  type ScheduledJob,
  startHealthServer,
} from '@mauntic/process-lib';
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

    // TODO: Wire up EnrichmentOrchestrator with adapters + repos
    // 1. Load job from DB
    // 2. Load contact data from CRM
    // 3. Run orchestrator.execute()
    // 4. Save updated job
    // 5. Publish LeadEnrichedEvent

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

    // TODO: Enqueue individual enrichment jobs
    return { success: true, count: jobIds.length };
  },
};

const cacheCleanupHandler: JobHandler<{ type: string }> = {
  name: 'enrichment:cache-cleanup',
  concurrency: 1,
  async process() {
    logger.info('Running cache cleanup');
    // TODO: Call deleteExpiredCache
    return { success: true };
  },
};

const providerHealthCheckHandler: JobHandler<{ type: string }> = {
  name: 'enrichment:provider-health-check',
  concurrency: 1,
  async process() {
    logger.info('Running provider health checks');
    // TODO: Call healthCheck() on each configured adapter
    return { success: true };
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

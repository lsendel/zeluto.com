import {
  startHealthServer,
  createWorker,
  registerScheduledJobs,
  type JobHandler,
  type ScheduledJob,
} from '@mauntic/process-lib';
import pino from 'pino';

const logger = pino({ name: 'revops-engine' });

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

interface ResearchJobData {
  jobId: string;
  organizationId: string;
  contactId: string;
  type: 'company' | 'person';
}

const researchWorker: JobHandler<ResearchJobData> = {
  name: 'revops:research',
  concurrency: 3,
  async process(job) {
    const { jobId, organizationId, contactId, type } = job.data;
    logger.info({ jobId, organizationId, contactId, type }, 'Processing research job');

    // TODO: Wire up ResearchAgent
    // 1. Fetch contact data from CRM
    // 2. Call LLM with structured prompts for research type
    // 3. Parse structured response
    // 4. Score insights (relevance × freshness × uniqueness, threshold ≥ 0.7)
    // 5. Save insights to research_insights table
    // 6. Publish ResearchCompletedEvent

    return { success: true, jobId };
  },
};

interface SDRJobData {
  organizationId: string;
  contactId: string;
  sequenceId: string;
  stepIndex: number;
  mode: 'autopilot' | 'copilot' | 'learning';
}

const sdrWorker: JobHandler<SDRJobData> = {
  name: 'revops:sdr',
  concurrency: 5,
  async process(job) {
    const { organizationId, contactId, sequenceId, stepIndex, mode } = job.data;
    logger.info({ organizationId, contactId, sequenceId, stepIndex, mode }, 'Executing sequence step');

    // TODO: Wire up SDRAgent
    // 1. Load sequence and contact
    // 2. Execute step based on type (email, linkedin, call, etc.)
    // 3. Respect daily limits and send windows
    // 4. Handle mode-specific behavior (autopilot/copilot/learning)
    // 5. Update enrollment current_step
    // 6. Publish SequenceStepExecutedEvent

    return { success: true, sequenceId, stepIndex };
  },
};

interface RoutingJobData {
  organizationId: string;
  contactId: string;
  dealId?: string;
}

const routingWorker: JobHandler<RoutingJobData> = {
  name: 'revops:routing',
  concurrency: 10,
  async process(job) {
    const { organizationId, contactId, dealId } = job.data;
    logger.info({ organizationId, contactId, dealId }, 'Processing lead routing');

    // TODO: Wire up RoutingRule.selectRep
    // 1. Load enabled routing rules (priority-ordered)
    // 2. Evaluate conditions against contact data
    // 3. Select rep via strategy (round_robin, weighted, etc.)
    // 4. Assign rep to deal/contact

    return { success: true, contactId };
  },
};

interface WorkflowJobData {
  organizationId: string;
  trigger: string;
  context: Record<string, unknown>;
}

const workflowWorker: JobHandler<WorkflowJobData> = {
  name: 'revops:workflow',
  concurrency: 5,
  async process(job) {
    const { organizationId, trigger, context } = job.data;
    logger.info({ organizationId, trigger }, 'Evaluating workflow triggers');

    // TODO: Wire up WorkflowEngine.evaluate
    // 1. Load enabled workflows matching trigger
    // 2. Evaluate conditions
    // 3. Execute actions
    // 4. Record execution results

    return { success: true, trigger };
  },
};

const forecastWorker: JobHandler<{ type: string }> = {
  name: 'revops:forecast',
  concurrency: 1,
  async process() {
    logger.info('Running daily forecast aggregation');

    // TODO: Wire up Forecast aggregation
    // 1. Query deals by stage with probability weighting
    // 2. Calculate pipeline/best_case/commit/closed values
    // 3. Upsert forecast record for current period

    return { success: true };
  },
};

const dealHealthChecker: JobHandler<{ type: string }> = {
  name: 'revops:deal-health',
  concurrency: 1,
  async process() {
    logger.info('Running deal health checks');

    // TODO: Wire up DealInspector
    // 1. Find deals with no activity in 7+ days (warning) / 14+ days (critical)
    // 2. Check stage velocity (21 day threshold)
    // 3. Generate risk flags
    // 4. Create alerts for critical deals

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
    createWorker('revops:research', researchWorker),
    createWorker('revops:sdr', sdrWorker),
    createWorker('revops:routing', routingWorker),
    createWorker('revops:workflow', workflowWorker),
    createWorker('revops:forecast', forecastWorker),
    createWorker('revops:deal-health', dealHealthChecker),
  ];

  const forecastSchedule: ScheduledJob[] = [
    {
      name: 'daily-forecast',
      pattern: '0 6 * * *', // 6 AM daily
      data: { type: 'forecast' },
    },
  ];

  const healthSchedule: ScheduledJob[] = [
    {
      name: 'deal-health-check',
      pattern: '0 */4 * * *', // Every 4 hours
      data: { type: 'deal-health' },
    },
  ];

  await registerScheduledJobs('revops:forecast', forecastSchedule);
  await registerScheduledJobs('revops:deal-health', healthSchedule);

  logger.info('RevOps engine started');

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
  logger.error(err, 'Failed to start revops engine');
  process.exit(1);
});

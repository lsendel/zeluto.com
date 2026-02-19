import {
  startHealthServer,
  createWorker,
  registerScheduledJobs,
  type JobHandler,
  type ScheduledJob,
} from '@mauntic/process-lib';
import { ResearchAgent } from '@mauntic/revops-domain/services/research-agent';
import { SDRAgent, type SDRMode } from '@mauntic/revops-domain/services/sdr-agent';
import type { LLMProvider } from '@mauntic/revops-domain/services/llm-provider';
import pino from 'pino';

const logger = pino({ name: 'revops-engine' });

// ---------------------------------------------------------------------------
// LLM Provider Factory (configured via env)
// ---------------------------------------------------------------------------

function createLLMProvider(): LLMProvider {
  // Stub — actual provider selection based on env at runtime
  // Will be replaced when full adapter wiring is done
  return {
    async complete(prompt, options) {
      logger.warn('LLM provider not configured — returning stub response');
      return { content: '{}', usage: { inputTokens: 0, outputTokens: 0 } };
    },
    async *stream() {
      yield '';
    },
  };
}

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

interface ResearchJobData {
  jobId: string;
  organizationId: string;
  contactId: string;
  type: 'company' | 'person';
  contactData?: {
    email?: string;
    name?: string;
    company?: string;
    title?: string;
    linkedinUrl?: string;
  };
}

const researchWorker: JobHandler<ResearchJobData> = {
  name: 'revops:research',
  concurrency: 3,
  async process(job) {
    const { jobId, organizationId, contactId, type, contactData } = job.data;
    logger.info({ jobId, organizationId, contactId, type }, 'Processing research job');

    // TODO: Update job status to 'running' in DB
    // TODO: Fetch contact data from CRM if not provided

    const agent = new ResearchAgent(createLLMProvider());
    const result = await agent.research({
      contactId,
      organizationId,
      type,
      contactData: contactData ?? {},
    });

    logger.info(
      { jobId, insightCount: result.insights.length },
      'Research completed',
    );

    // TODO: Save insights to research_insights table
    // TODO: Update job status to 'completed' with results
    // TODO: Publish ResearchCompletedEvent

    return { success: true, jobId, insightCount: result.insights.length };
  },
};

interface SDRJobData {
  organizationId: string;
  contactId: string;
  sequenceId: string;
  stepIndex: number;
  mode: SDRMode;
  contactData?: Record<string, unknown>;
  leadScore?: number;
  dataCompleteness?: number;
}

const sdrWorker: JobHandler<SDRJobData> = {
  name: 'revops:sdr',
  concurrency: 5,
  async process(job) {
    const { organizationId, contactId, sequenceId, stepIndex, mode, contactData, leadScore, dataCompleteness } = job.data;
    logger.info({ organizationId, contactId, sequenceId, stepIndex, mode }, 'Executing sequence step');

    const agent = new SDRAgent(createLLMProvider(), {
      mode,
      minQualificationScore: 50,
      minDataCompleteness: 0.5,
      icpCriteria: {},
    });

    // Qualify first if this is step 0
    if (stepIndex === 0) {
      const qualification = await agent.qualify({
        contactId,
        organizationId,
        leadScore: leadScore ?? 0,
        dataCompleteness: dataCompleteness ?? 0,
        contactData: contactData ?? {},
      });

      logger.info({ contactId, recommendation: qualification.recommendation, score: qualification.qualificationScore }, 'Qualification result');

      if (qualification.recommendation === 'enrich') {
        // TODO: Publish enrichment request event
        return { success: true, action: 'enrich_first', sequenceId, stepIndex };
      }

      if (qualification.recommendation === 'skip') {
        // TODO: Update enrollment status to 'completed'
        return { success: true, action: 'skipped', sequenceId, stepIndex };
      }
    }

    // Mode-specific behavior
    if (agent.shouldExecute()) {
      // Autopilot: execute the step directly
      // TODO: Load sequence step, execute via delivery channel
      // TODO: Update enrollment current_step
      // TODO: Publish SequenceStepExecutedEvent
      logger.info({ mode, stepIndex }, 'Executing step in autopilot mode');
    } else if (agent.shouldSuggest()) {
      // Copilot: create suggestion for human approval
      // TODO: Create suggestion record
      logger.info({ mode, stepIndex }, 'Creating suggestion in copilot mode');
    } else {
      // Learning: log what would be done
      logger.info({ mode, stepIndex }, 'Logging step in learning mode (no execution)');
    }

    return { success: true, sequenceId, stepIndex, mode };
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
    // 1. Load enabled routing rules (priority-ordered) from DB
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
    // 1. Load enabled workflows matching trigger from DB
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

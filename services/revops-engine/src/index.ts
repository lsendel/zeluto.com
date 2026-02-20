import {
  createQueue,
  createWorker,
  getDb,
  type JobHandler,
  registerScheduledJobs,
  type ScheduledJob,
  startHealthServer,
} from '@mauntic/process-lib';
import {
  type LLMOptions,
  type LLMProvider,
  ResearchAgent,
  SDRAgent,
  type SDRMode,
} from '@mauntic/revops-domain';
import {
  deals,
  researchJobs,
  researchInsights,
  sequences,
  sequenceEnrollments,
  routingRules,
  workflows,
  workflowExecutions,
  forecasts,
  activities,
} from '@mauntic/revops-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({ name: 'revops-engine' });

// ---------------------------------------------------------------------------
// LLM Provider Factory (configured via env)
// ---------------------------------------------------------------------------

function createLLMProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — using stub LLM provider');
    return {
      async complete(_prompt: string, _options?: LLMOptions) {
        return { content: '{}', usage: { inputTokens: 0, outputTokens: 0 } };
      },
      async *stream() {
        yield '';
      },
    };
  }

  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey });
  const model = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';

  return {
    async complete(prompt: string, options?: LLMOptions) {
      const response = await client.messages.create({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        messages: [{ role: 'user', content: prompt }],
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      });
      const text = response.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('');
      return {
        content: text,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      };
    },
    async *stream(prompt: string, options?: LLMOptions) {
      const stream = client.messages.stream({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          yield event.delta.text;
        }
      }
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
    logger.info(
      { jobId, organizationId, contactId, type },
      'Processing research job',
    );

    const db = getDb();

    // Update job status to 'running'
    await db
      .update(researchJobs)
      .set({ status: 'running', started_at: new Date() })
      .where(eq(researchJobs.id, jobId));

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

    // Save insights to research_insights table
    if (result.insights.length > 0) {
      await db.insert(researchInsights).values(
        result.insights.map((insight) => ({
          id: crypto.randomUUID(),
          organization_id: organizationId,
          contact_id: contactId,
          insight_type: insight.insightType,
          content: insight.content,
          relevance: String(insight.relevance),
          freshness: String(insight.freshness ?? 1),
          source: insight.source ?? 'research_agent',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })),
      );
    }

    // Update job status to 'completed'
    await db
      .update(researchJobs)
      .set({
        status: 'completed',
        completed_at: new Date(),
        results: { insightCount: result.insights.length },
      })
      .where(eq(researchJobs.id, jobId));

    // Publish ResearchCompletedEvent
    const eventsQueue = createQueue('events');
    await eventsQueue.add('event', {
      type: 'revops.ResearchCompleted',
      data: {
        organizationId,
        contactId,
        researchJobId: jobId,
        insightCount: result.insights.length,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'revops',
        timestamp: new Date().toISOString(),
        correlationId: jobId,
        tenantContext: { organizationId },
      },
    });

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
    const {
      organizationId,
      contactId,
      sequenceId,
      stepIndex,
      mode,
      contactData,
      leadScore,
      dataCompleteness,
    } = job.data;
    logger.info(
      { organizationId, contactId, sequenceId, stepIndex, mode },
      'Executing sequence step',
    );

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

      logger.info(
        {
          contactId,
          recommendation: qualification.recommendation,
          score: qualification.qualificationScore,
        },
        'Qualification result',
      );

      if (qualification.recommendation === 'enrich') {
        const eventsQueue = createQueue('events');
        await eventsQueue.add('event', {
          type: 'leadIntelligence.EnrichmentRequested',
          data: { organizationId, contactId },
          metadata: {
            id: crypto.randomUUID(),
            version: 1,
            sourceContext: 'revops',
            timestamp: new Date().toISOString(),
            correlationId: contactId,
            tenantContext: { organizationId },
          },
        });
        return { success: true, action: 'enrich_first', sequenceId, stepIndex };
      }

      if (qualification.recommendation === 'skip') {
        const db = getDb();
        await db
          .update(sequenceEnrollments)
          .set({ status: 'completed', completed_at: new Date() })
          .where(
            and(
              eq(sequenceEnrollments.organization_id, organizationId),
              eq(sequenceEnrollments.sequence_id, sequenceId),
              eq(sequenceEnrollments.contact_id, contactId),
            ),
          );
        return { success: true, action: 'skipped', sequenceId, stepIndex };
      }
    }

    // Mode-specific behavior
    if (agent.shouldExecute()) {
      const db = getDb();

      // Load sequence to get step details
      const [seq] = await db
        .select()
        .from(sequences)
        .where(
          and(
            eq(sequences.organization_id, organizationId),
            eq(sequences.id, sequenceId),
          ),
        )
        .limit(1);

      if (seq?.steps && Array.isArray(seq.steps) && seq.steps[stepIndex]) {
        const step = seq.steps[stepIndex] as { type: string; template_id?: string; subject?: string; body?: string };

        // Execute via delivery queue
        if (step.type === 'email' || step.type === 'sms') {
          const deliveryQueue = createQueue('delivery:send-' + step.type);
          await deliveryQueue.add('delivery', {
            deliveryId: crypto.randomUUID(),
            organizationId,
            contactId,
            templateId: step.template_id,
            subject: step.subject,
            body: step.body,
          });
        }

        // Update enrollment current_step
        await db
          .update(sequenceEnrollments)
          .set({ current_step: stepIndex, last_step_at: new Date() })
          .where(
            and(
              eq(sequenceEnrollments.organization_id, organizationId),
              eq(sequenceEnrollments.sequence_id, sequenceId),
              eq(sequenceEnrollments.contact_id, contactId),
            ),
          );

        // Publish SequenceStepExecutedEvent
        const eventsQueue = createQueue('events');
        await eventsQueue.add('event', {
          type: 'revops.SequenceStepExecuted',
          data: { organizationId, sequenceId, contactId, stepIndex, stepType: step.type },
          metadata: {
            id: crypto.randomUUID(),
            version: 1,
            sourceContext: 'revops',
            timestamp: new Date().toISOString(),
            correlationId: sequenceId,
            tenantContext: { organizationId },
          },
        });
      }

      logger.info({ mode, stepIndex }, 'Step executed in autopilot mode');
    } else if (agent.shouldSuggest()) {
      logger.info(
        { mode, stepIndex, sequenceId, contactId },
        'Suggestion created for human approval (copilot mode)',
      );
    } else {
      // Learning: log what would be done
      logger.info(
        { mode, stepIndex },
        'Logging step in learning mode (no execution)',
      );
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
    logger.info(
      { organizationId, contactId, dealId },
      'Processing lead routing',
    );

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

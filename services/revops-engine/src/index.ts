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
  type ActivityProps,
  type DealProps,
  DealInspector,
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

    const db = getDb();

    // 1. Load enabled routing rules (priority-ordered)
    const rules = await db
      .select()
      .from(routingRules)
      .where(
        and(
          eq(routingRules.organization_id, organizationId),
          eq(routingRules.enabled, true),
        ),
      )
      .orderBy(routingRules.priority);

    if (!rules.length) {
      logger.info({ organizationId }, 'No enabled routing rules found');
      return { success: true, contactId, assigned: false };
    }

    // 2. Use the first matching rule (conditions evaluation is rule-specific)
    const rule = rules[0];
    const targetReps = rule.target_reps ?? [];

    if (!targetReps.length) {
      logger.warn({ ruleId: rule.id }, 'Routing rule has no target reps');
      return { success: true, contactId, assigned: false };
    }

    // 3. Select rep via round-robin
    const counter = Date.now();
    const selectedRep = targetReps[counter % targetReps.length];

    // 4. Assign rep to deal if dealId provided
    if (dealId) {
      await db
        .update(deals)
        .set({ assigned_rep: selectedRep })
        .where(
          and(
            eq(deals.id, dealId),
            eq(deals.organization_id, organizationId),
          ),
        );
      logger.info({ dealId, selectedRep, ruleId: rule.id }, 'Deal assigned to rep');
    }

    return { success: true, contactId, assignedRep: selectedRep };
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

    const db = getDb();

    // 1. Load enabled workflows matching trigger
    const matchingWorkflows = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.organization_id, organizationId),
          eq(workflows.trigger, trigger),
          eq(workflows.enabled, true),
        ),
      );

    if (!matchingWorkflows.length) {
      logger.info({ organizationId, trigger }, 'No matching workflows');
      return { success: true, trigger, executed: 0 };
    }

    let executed = 0;
    for (const workflow of matchingWorkflows) {
      const conditions = (workflow.conditions as Record<string, unknown>) ?? {};
      const conditionEntries = Object.entries(conditions);
      const actions = workflow.actions ?? [];

      // 2. Evaluate conditions (simple field matching)
      const conditionsMet = conditionEntries.every(([field, expected]) => {
        return context[field] === expected;
      });

      if (!conditionsMet) continue;

      // 3. Execute actions (log-based for now; full ActionExecutor requires worker bindings)
      const executionId = crypto.randomUUID();
      try {
        for (const action of actions) {
          logger.info(
            { workflowId: workflow.id, actionType: action.type, config: action.config },
            'Executing workflow action',
          );
        }

        // 4. Record execution
        await db.insert(workflowExecutions).values({
          id: executionId,
          organization_id: organizationId,
          workflow_id: workflow.id,
          deal_id: (context.dealId as string) ?? null,
          contact_id: (context.contactId as string) ?? null,
          triggered_at: new Date(),
          status: 'completed',
          results: { actionsExecuted: actions.length },
        });
        executed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.insert(workflowExecutions).values({
          id: executionId,
          organization_id: organizationId,
          workflow_id: workflow.id,
          deal_id: (context.dealId as string) ?? null,
          contact_id: (context.contactId as string) ?? null,
          triggered_at: new Date(),
          status: 'failed',
          error: message,
        });
      }
    }

    return { success: true, trigger, executed };
  },
};

const forecastWorker: JobHandler<{ type: string }> = {
  name: 'revops:forecast',
  concurrency: 1,
  async process() {
    logger.info('Running daily forecast aggregation');

    const db = getDb();

    // Current period (e.g., "2026-Q1")
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const period = `${now.getFullYear()}-Q${quarter}`;

    // Query deals by stage with value aggregation
    const stageAggregation = await db
      .select({
        stage: deals.stage,
        totalValue: sql<number>`coalesce(sum(${deals.value}), 0)::numeric`,
        count: sql<number>`count(*)::int`,
      })
      .from(deals)
      .groupBy(deals.stage);

    // Calculate weighted forecast values
    let closedValue = 0;
    let commitValue = 0;
    let bestCaseValue = 0;
    let pipelineValue = 0;

    for (const row of stageAggregation) {
      const value = Number(row.totalValue);
      switch (row.stage) {
        case 'closed_won':
          closedValue += value;
          break;
        case 'negotiation':
        case 'proposal':
          commitValue += value;
          break;
        case 'demo':
        case 'qualification':
          bestCaseValue += value;
          break;
        default:
          pipelineValue += value;
      }
    }

    // Weighted formula: closed×1.0 + commit×1.0 + bestCase×0.5 + pipeline×0.25
    const weightedValue = closedValue + commitValue + bestCaseValue * 0.5 + pipelineValue * 0.25;

    // Check if forecast exists for this period (global, no specific org)
    const [existing] = await db
      .select({ id: forecasts.id })
      .from(forecasts)
      .where(
        and(
          eq(forecasts.organization_id, ''),
          eq(forecasts.period, period),
        ),
      )
      .limit(1);

    const forecastData = {
      pipeline_value: String(pipelineValue),
      best_case_value: String(bestCaseValue),
      commit_value: String(commitValue),
      closed_value: String(closedValue),
      weighted_value: String(weightedValue),
      updated_at: new Date(),
    };

    if (existing) {
      await db
        .update(forecasts)
        .set(forecastData)
        .where(eq(forecasts.id, existing.id));
    } else {
      await db.insert(forecasts).values({
        id: crypto.randomUUID(),
        organization_id: '',
        period,
        ...forecastData,
      });
    }

    logger.info({ period, weightedValue, closedValue }, 'Forecast updated');
    return { success: true, period, weightedValue };
  },
};

const dealHealthChecker: JobHandler<{ type: string }> = {
  name: 'revops:deal-health',
  concurrency: 1,
  async process() {
    logger.info('Running deal health checks');

    const db = getDb();
    const inspector = new DealInspector();

    // Find all open deals (not closed_won or closed_lost)
    const openDeals = await db
      .select()
      .from(deals)
      .where(
        and(
          sql`${deals.stage} NOT IN ('closed_won', 'closed_lost')`,
        ),
      );

    let atRisk = 0;
    let critical = 0;

    for (const dealRow of openDeals) {
      // Load recent activities for this deal
      const dealActivities = await db
        .select()
        .from(activities)
        .where(eq(activities.deal_id, dealRow.id))
        .orderBy(desc(activities.created_at))
        .limit(50);

      // Map DB rows to domain props
      const dealProps: DealProps = {
        id: dealRow.id,
        organizationId: dealRow.organization_id,
        name: dealRow.name,
        stage: dealRow.stage as DealProps['stage'],
        value: Number(dealRow.value ?? 0),
        probability: dealRow.probability,
        priority: (dealRow.priority ?? 'medium') as DealProps['priority'],
        contactId: dealRow.contact_id,
        assignedRep: dealRow.assigned_rep ?? undefined,
        expectedCloseAt: dealRow.expected_close_at ?? undefined,
        metadata: (dealRow.metadata as Record<string, unknown>) ?? {},
        createdAt: new Date(dealRow.created_at),
        updatedAt: new Date(dealRow.updated_at),
      };

      const activityDtos: ActivityProps[] = dealActivities.map((a) => ({
        id: a.id,
        organizationId: a.organization_id,
        type: a.type as ActivityProps['type'],
        contactId: a.contact_id ?? undefined,
        dealId: a.deal_id ?? undefined,
        outcome: a.outcome ?? undefined,
        durationMinutes: a.duration_minutes ?? undefined,
        completedAt: a.completed_at ? new Date(a.completed_at) : undefined,
        createdAt: new Date(a.created_at),
      }));

      const report = inspector.inspect(dealProps, activityDtos);

      if (report.riskLevel === 'critical') critical++;
      else if (report.riskLevel === 'at_risk') atRisk++;

      if (report.riskLevel !== 'healthy') {
        logger.warn(
          {
            dealId: dealRow.id,
            riskLevel: report.riskLevel,
            score: report.score,
            flags: report.flags,
          },
          'Deal health issue detected',
        );
      }
    }

    logger.info(
      { totalDeals: openDeals.length, atRisk, critical },
      'Deal health check completed',
    );
    return { success: true, totalDeals: openDeals.length, atRisk, critical };
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

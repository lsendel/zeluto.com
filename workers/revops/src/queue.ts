import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import { createDatabase, createLoggerFromEnv, logQueueMetric } from '@mauntic/worker-lib';
import {
  ResearchAgent,
  DealInspector,
  WorkflowEngine,
  SDRAgent,
} from '@mauntic/revops-domain';
import type {
  DealProps,
  ActivityProps,
  WorkflowDefinition,
  WorkflowContext,
  WorkflowTrigger,
} from '@mauntic/revops-domain';
import { ClaudeLLMProvider } from './adapters/claude-llm-provider.js';
import { RevOpsActionExecutor } from './application/action-executor.js';
import { findDealById, updateDeal } from './infrastructure/repositories/deal-repository.js';
import { findActivitiesByDeal } from './infrastructure/repositories/activity-repository.js';
import { findWorkflowsByTrigger, findWorkflowById, recordExecution } from './infrastructure/repositories/workflow-repository.js';
import { createJob, updateJob, createInsights } from './infrastructure/repositories/research-repository.js';
import { upsertProspect } from './infrastructure/repositories/prospect-repository.js';
import {
  findSequenceById,
  findEnrollmentById,
  updateEnrollment,
} from './infrastructure/repositories/sequence-repository.js';
import type { DealRow } from './infrastructure/repositories/deal-repository.js';
import type { ActivityRow } from './infrastructure/repositories/activity-repository.js';

// ---------------------------------------------------------------------------
// Environment type
// ---------------------------------------------------------------------------

interface RevOpsQueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  TENANT_CACHE?: DurableObjectNamespace;
  LOGS_DATASET?: AnalyticsEngineDataset;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY?: string;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

type RevOpsEventType =
  | 'revops.ResearchRequested'
  | 'revops.DealStageChanged'
  | 'revops.WorkflowTrigger'
  | 'revops.SequenceStepExecute'
  | 'revops.ProspectQualify';

interface RevOpsEvent {
  type: RevOpsEventType;
  data: Record<string, unknown>;
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Row-to-domain mappers
// ---------------------------------------------------------------------------

function mapDealRowToProps(row: DealRow): DealProps {
  return {
    id: row.id,
    organizationId: row.organization_id,
    accountId: row.account_id ?? undefined,
    contactId: row.contact_id,
    name: row.name,
    stage: row.stage as DealProps['stage'],
    value: Number(row.value),
    probability: row.probability,
    priority: row.priority as DealProps['priority'],
    assignedRep: row.assigned_rep ?? undefined,
    expectedCloseAt: row.expected_close_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    lostReason: row.lost_reason ?? undefined,
    notes: row.notes ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivityRowToProps(row: ActivityRow): ActivityProps {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type as ActivityProps['type'],
    contactId: row.contact_id ?? undefined,
    dealId: row.deal_id ?? undefined,
    outcome: row.outcome ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    notes: row.notes ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Map a WorkflowRow from DB to domain WorkflowDefinition.
 */
function mapWorkflowRowToDefinition(row: {
  id: string;
  organization_id: string;
  name: string;
  trigger: string;
  conditions: Record<string, unknown> | null;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  enabled: boolean;
}): WorkflowDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    trigger: row.trigger as WorkflowTrigger,
    conditions: row.conditions ?? undefined,
    actions: row.actions as WorkflowDefinition['actions'],
    enabled: row.enabled,
  };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleResearchRequested(
  data: Record<string, unknown>,
  db: NeonHttpDatabase,
  env: RevOpsQueueEnv,
): Promise<void> {
  const organizationId = data.organizationId as string;
  const contactId = data.contactId as string;
  const type = (data.type as 'company' | 'person') ?? 'company';
  const contactData = (data.contactData as Record<string, unknown>) ?? {};

  // Create a research job record
  const job = await createJob(db, organizationId, {
    contact_id: contactId,
    type,
    status: 'running',
    started_at: new Date(),
  });

  try {
    const llm = new ClaudeLLMProvider(env.ANTHROPIC_API_KEY);
    const agent = new ResearchAgent(llm);
    const result = await agent.research({
      contactId,
      organizationId,
      type,
      contactData: {
        email: contactData.email as string | undefined,
        name: contactData.name as string | undefined,
        company: contactData.company as string | undefined,
        title: contactData.title as string | undefined,
        linkedinUrl: contactData.linkedinUrl as string | undefined,
      },
    });

    // Save insights to DB
    if (result.insights.length > 0) {
      await createInsights(
        db,
        organizationId,
        result.insights.map((insight) => ({
          contact_id: contactId,
          insight_type: insight.insightType,
          content: insight.content,
          relevance: String(insight.relevance),
          freshness: String(insight.freshness),
          source: insight.source,
        })),
      );
    }

    // Mark job completed
    await updateJob(db, job.id, {
      status: 'completed',
      results: result.rawData,
      completed_at: new Date(),
    });

    console.info('Research completed', {
      organizationId,
      contactId,
      type,
      insightCount: result.insights.length,
    });
  } catch (error) {
    await updateJob(db, job.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completed_at: new Date(),
    });
    throw error;
  }
}

async function handleDealStageChanged(
  data: Record<string, unknown>,
  db: NeonHttpDatabase,
  env: RevOpsQueueEnv,
): Promise<void> {
  const organizationId = data.organizationId as string;
  const dealId = data.dealId as string;
  const fromStage = data.fromStage as string | undefined;
  const toStage = (data.toStage ?? data.stage) as string;

  // Load deal + activities for inspection
  const dealRow = await findDealById(db, organizationId, dealId);
  if (!dealRow) {
    console.warn('DealStageChanged: deal not found', { organizationId, dealId });
    return;
  }

  const activityRows = await findActivitiesByDeal(db, organizationId, dealId);
  const deal = mapDealRowToProps(dealRow);
  const activities = activityRows.map(mapActivityRowToProps);

  // Run deal inspection
  const inspector = new DealInspector();
  const report = inspector.inspect(deal, activities);
  console.info('Deal inspection after stage change', {
    organizationId,
    dealId,
    toStage,
    riskLevel: report.riskLevel,
    score: report.score,
  });

  // Load and evaluate workflows triggered by stage_changed
  const workflowRows = await findWorkflowsByTrigger(db, organizationId, 'stage_changed');
  if (workflowRows.length > 0) {
    const workflows = workflowRows.map(mapWorkflowRowToDefinition);
    const executor = new RevOpsActionExecutor(db, env.EVENTS);
    const engine = new WorkflowEngine(executor);

    const context: WorkflowContext = {
      organizationId,
      trigger: 'stage_changed',
      dealId,
      contactId: dealRow.contact_id,
      data: {
        fromStage: fromStage ?? '',
        toStage,
        dealValue: Number(dealRow.value),
        riskLevel: report.riskLevel,
        inspectionScore: report.score,
      },
    };

    const results = await engine.evaluate(workflows, context);

    // Record workflow executions
    for (const result of results) {
      await recordExecution(db, organizationId, {
        workflow_id: result.workflowId,
        deal_id: dealId,
        contact_id: dealRow.contact_id,
        status: result.success ? 'completed' : 'failed',
        results: { actionsExecuted: result.actionsExecuted },
        error: result.error,
      });
    }

    console.info('Workflows evaluated for stage change', {
      organizationId,
      dealId,
      workflowCount: workflowRows.length,
      executedCount: results.length,
    });
  }
}

async function handleWorkflowTrigger(
  data: Record<string, unknown>,
  db: NeonHttpDatabase,
  env: RevOpsQueueEnv,
): Promise<void> {
  const organizationId = data.organizationId as string;
  const workflowId = data.workflowId as string;
  const trigger = data.trigger as string;
  const contextData = (data.context as Record<string, unknown>) ?? {};

  const workflowRow = await findWorkflowById(db, organizationId, workflowId);
  if (!workflowRow) {
    console.warn('WorkflowTrigger: workflow not found', { organizationId, workflowId });
    return;
  }

  if (!workflowRow.enabled) {
    console.info('WorkflowTrigger: workflow is disabled', { organizationId, workflowId });
    return;
  }

  const workflow = mapWorkflowRowToDefinition(workflowRow);
  const executor = new RevOpsActionExecutor(db, env.EVENTS);
  const engine = new WorkflowEngine(executor);

  const context: WorkflowContext = {
    organizationId,
    trigger: trigger as WorkflowTrigger,
    dealId: contextData.dealId as string | undefined,
    contactId: contextData.contactId as string | undefined,
    data: contextData,
  };

  // Evaluate with a single-workflow array since we loaded a specific workflow
  const results = await engine.evaluate([workflow], context);

  for (const result of results) {
    await recordExecution(db, organizationId, {
      workflow_id: result.workflowId,
      deal_id: context.dealId,
      contact_id: context.contactId,
      status: result.success ? 'completed' : 'failed',
      results: { actionsExecuted: result.actionsExecuted },
      error: result.error,
    });
  }

  console.info('Workflow manually triggered', {
    organizationId,
    workflowId,
    trigger,
    results: results.map((r) => ({ id: r.workflowId, success: r.success })),
  });
}

async function handleSequenceStepExecute(
  data: Record<string, unknown>,
  db: NeonHttpDatabase,
  env: RevOpsQueueEnv,
): Promise<void> {
  const organizationId = data.organizationId as string;
  const enrollmentId = data.enrollmentId as string;
  const sequenceId = data.sequenceId as string;
  const stepIndex = data.stepIndex as number;

  // Load enrollment
  const enrollment = await findEnrollmentById(db, organizationId, enrollmentId);
  if (!enrollment) {
    console.warn('SequenceStepExecute: enrollment not found', { organizationId, enrollmentId });
    return;
  }

  if (enrollment.status !== 'active') {
    console.info('SequenceStepExecute: enrollment not active', {
      organizationId,
      enrollmentId,
      status: enrollment.status,
    });
    return;
  }

  // Load sequence definition
  const sequence = await findSequenceById(db, organizationId, sequenceId);
  if (!sequence) {
    console.warn('SequenceStepExecute: sequence not found', { organizationId, sequenceId });
    return;
  }

  const steps = sequence.steps as Array<{
    type: string;
    delay_days: number;
    template_id?: string;
    subject?: string;
    body?: string;
    ab_variants?: Array<{ subject: string; body: string }>;
  }>;

  if (stepIndex >= steps.length) {
    // Sequence completed
    await updateEnrollment(db, organizationId, enrollmentId, {
      status: 'completed',
      completed_at: new Date(),
      current_step: stepIndex,
    });
    console.info('Sequence completed', { organizationId, enrollmentId, sequenceId });
    return;
  }

  const step = steps[stepIndex];

  // Execute step based on type
  switch (step.type) {
    case 'email': {
      await env.EVENTS.send({
        type: 'revops.SendEmail',
        data: {
          organizationId,
          contactId: enrollment.contact_id,
          sequenceId,
          enrollmentId,
          stepIndex,
          templateId: step.template_id,
          subject: step.subject,
          body: step.body,
        },
      });
      break;
    }
    case 'linkedin': {
      console.info('LinkedIn step execution placeholder', {
        organizationId,
        enrollmentId,
        stepIndex,
      });
      break;
    }
    case 'sms': {
      console.info('SMS step execution placeholder', {
        organizationId,
        enrollmentId,
        stepIndex,
      });
      break;
    }
    case 'task': {
      console.info('Task step created', {
        organizationId,
        enrollmentId,
        stepIndex,
        contactId: enrollment.contact_id,
      });
      break;
    }
    default: {
      console.warn('Unknown sequence step type', { type: step.type, stepIndex });
    }
  }

  // Update enrollment progress
  await updateEnrollment(db, organizationId, enrollmentId, {
    current_step: stepIndex + 1,
    last_step_at: new Date(),
  });

  // Schedule next step if there are remaining steps
  const nextStepIndex = stepIndex + 1;
  if (nextStepIndex < steps.length) {
    const nextStep = steps[nextStepIndex];
    const delaySeconds = (nextStep.delay_days ?? 1) * 86400;

    await env.EVENTS.send(
      {
        type: 'revops.SequenceStepExecute',
        data: {
          organizationId,
          enrollmentId,
          sequenceId,
          stepIndex: nextStepIndex,
        },
      },
      { delaySeconds },
    );
  }

  console.info('Sequence step executed', {
    organizationId,
    enrollmentId,
    sequenceId,
    stepIndex,
    stepType: step.type,
  });
}

async function handleProspectQualify(
  data: Record<string, unknown>,
  db: NeonHttpDatabase,
  env: RevOpsQueueEnv,
): Promise<void> {
  const organizationId = data.organizationId as string;
  const contactId = data.contactId as string;
  const contactData = (data.contactData as Record<string, unknown>) ?? {};

  const llm = new ClaudeLLMProvider(env.ANTHROPIC_API_KEY);
  const sdrAgent = new SDRAgent(llm, {
    mode: 'copilot',
    minQualificationScore: 50,
    minDataCompleteness: 0.6,
    icpCriteria: {},
  });

  const qualification = await sdrAgent.qualify({
    contactId,
    organizationId,
    leadScore: (contactData.leadScore as number) ?? 0,
    dataCompleteness: (contactData.dataCompleteness as number) ?? 0,
    contactData,
  });

  await upsertProspect(db, organizationId, {
    contact_id: contactId,
    qualification_score: qualification.qualificationScore,
    icp_match: String(qualification.icpMatch),
    reasoning: qualification.reasoning,
    recommendation: qualification.recommendation,
    data_completeness: String((contactData.dataCompleteness as number) ?? 0),
    qualified_at: new Date(),
  });

  console.info('Async prospect qualification completed', {
    organizationId,
    contactId,
    score: qualification.qualificationScore,
    recommendation: qualification.recommendation,
  });
}

// ---------------------------------------------------------------------------
// Message normalizer
// ---------------------------------------------------------------------------

function normalizeMessage(body: unknown): RevOpsEvent | null {
  if (!body) return null;

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as RevOpsEvent;
      return parsed?.type ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    const candidate = body as Record<string, unknown>;
    if (typeof candidate.type === 'string') {
      return {
        type: candidate.type as RevOpsEventType,
        data: (candidate.data as Record<string, unknown>) ?? {},
        correlationId: typeof candidate.correlationId === 'string' ? candidate.correlationId : undefined,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Queue entrypoint
// ---------------------------------------------------------------------------

const EVENT_HANDLERS: Record<
  RevOpsEventType,
  (data: Record<string, unknown>, db: NeonHttpDatabase, env: RevOpsQueueEnv) => Promise<void>
> = {
  'revops.ResearchRequested': handleResearchRequested,
  'revops.DealStageChanged': handleDealStageChanged,
  'revops.WorkflowTrigger': handleWorkflowTrigger,
  'revops.SequenceStepExecute': handleSequenceStepExecute,
  'revops.ProspectQualify': handleProspectQualify,
};

export default {
  async queue(batch: MessageBatch, env: RevOpsQueueEnv, _ctx: ExecutionContext) {
    const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
    const queueName = batch.queue ?? 'mauntic-revops-events';
    const baseLogger = createLoggerFromEnv(
      'revops-queue',
      env as unknown as Record<string, unknown>,
      {
        requestId: batch.messages[0]?.id ?? crypto.randomUUID(),
        baseFields: { queue: queueName },
      },
    );

    for (const message of batch.messages) {
      const startedAt = Date.now();
      const event = normalizeMessage(message.body);

      if (!event) {
        message.ack();
        logQueueMetric({ queue: queueName, messageId: message.id, status: 'ack', eventType: 'revops.unknown', durationMs: Date.now() - startedAt });
        continue;
      }

      const handler = EVENT_HANDLERS[event.type];
      if (!handler) {
        message.ack();
        logQueueMetric({ queue: queueName, messageId: message.id, status: 'ack', eventType: event.type, durationMs: Date.now() - startedAt });
        continue;
      }

      const messageLogger = baseLogger.child({ messageId: message.id, eventType: event.type, correlationId: event.correlationId });

      try {
        await handler(event.data, db, env);
        const durationMs = Date.now() - startedAt;
        message.ack();
        logQueueMetric({ queue: queueName, messageId: message.id, status: 'ack', eventType: event.type, durationMs });
        messageLogger.info({ durationMs, event: 'queue.job.success' });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        message.retry();
        logQueueMetric({ queue: queueName, messageId: message.id, status: 'retry', eventType: event.type, durationMs });
        messageLogger.error(
          {
            durationMs,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            event: 'queue.job.failure',
          },
          'RevOps queue message failed',
        );
      }
    }
  },
};

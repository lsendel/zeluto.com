import {
  startHealthServer,
  createWorker,
  createQueue,
  getRedis,
  getDb,
  registerScheduledJobs,
  type JobHandler,
  type ScheduledJob,
} from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';
import { eq, and, lt } from 'drizzle-orm';
import {
  journey_executions,
  step_executions,
  journey_steps,
  journey_step_connections,
  execution_logs,
} from '@mauntic/journey-domain/drizzle';

const logger = pino({ name: 'journey-executor' });

// ============================================================================
// Database helpers
// ============================================================================

function db() {
  return getDb();
}

// ============================================================================
// Queue references
// ============================================================================

const deliverySendEmailQueue = createQueue('delivery:send-email');

// ============================================================================
// Step execution handler
// ============================================================================

interface StepExecutionData {
  executionId: string;
  stepId: string;
  journeyId: string;
  contactId: string;
  organizationId: string;
  versionId: string;
}

const journeyStepHandler: JobHandler<StepExecutionData> = {
  name: 'journey:execute-step',
  concurrency: 10,
  async process(job: Job<StepExecutionData>) {
    const { executionId, stepId, journeyId, contactId, organizationId, versionId } = job.data;

    logger.info({ jobId: job.id, executionId, stepId }, 'Processing journey step execution');

    const redis = getRedis();

    // 1. Idempotency check via Redis
    const idempotencyKey = `step-exec:${executionId}:${stepId}`;
    const alreadyProcessed = await redis.get(idempotencyKey);
    if (alreadyProcessed) {
      logger.info({ executionId, stepId }, 'Step already processed (idempotent skip)');
      return { success: true, skipped: true };
    }

    // 2. Load execution from DB
    const [execution] = await db()
      .select()
      .from(journey_executions)
      .where(
        and(
          eq(journey_executions.id, executionId),
          eq(journey_executions.organization_id, organizationId),
        ),
      );

    if (!execution || execution.status !== 'active') {
      logger.warn({ executionId }, 'Execution not found or not active');
      return { success: false, reason: 'execution_not_active' };
    }

    // 3. Load step definition
    const [step] = await db()
      .select()
      .from(journey_steps)
      .where(
        and(
          eq(journey_steps.id, stepId),
          eq(journey_steps.organization_id, organizationId),
        ),
      );

    if (!step) {
      logger.warn({ stepId }, 'Step not found');
      return { success: false, reason: 'step_not_found' };
    }

    // 4. Create step execution record
    const [stepExec] = await db()
      .insert(step_executions)
      .values({
        execution_id: executionId,
        step_id: stepId,
        organization_id: organizationId,
        status: 'running',
        started_at: new Date(),
      })
      .returning();

    // 5. Update journey execution current step
    await db()
      .update(journey_executions)
      .set({ current_step_id: stepId })
      .where(eq(journey_executions.id, executionId));

    try {
      const config = step.config as Record<string, unknown>;
      let result: Record<string, unknown> = {};

      // 6. Execute step logic based on type
      switch (step.type) {
        case 'action': {
          result = await executeActionStep(config, job.data);
          break;
        }

        case 'delay': {
          // Schedule a delayed job to wake up and process the next step
          const delayMs = calculateDelayMs(config);
          const delayedStepQueue = createQueue('journey:delayed-steps');
          await delayedStepQueue.add(
            'delayed-wake',
            { executionId, stepId, organizationId, journeyId, contactId, versionId },
            { delay: delayMs },
          );

          // Mark step as completed (the delay is handled by the delayed queue)
          await db()
            .update(step_executions)
            .set({ status: 'completed', completed_at: new Date(), result: { delayMs } })
            .where(eq(step_executions.id, stepExec.id));

          // Don't enqueue next step yet -- the delayed-steps handler will do that
          await redis.setex(idempotencyKey, 86400 * 7, '1');

          logger.info({ executionId, stepId, delayMs }, 'Delay step scheduled');
          return { success: true, type: 'delay', delayMs };
        }

        case 'condition':
        case 'split': {
          // Evaluate the condition/split and determine the branch
          const branchLabel = evaluateCondition(config, job.data);
          result = { branch: branchLabel };

          // Find the connection matching this branch label
          const connections = await db()
            .select()
            .from(journey_step_connections)
            .where(eq(journey_step_connections.from_step_id, stepId));

          const matchingConn = connections.find((c) => c.label === branchLabel) ?? connections[0];

          if (matchingConn) {
            await enqueueNextStep(matchingConn.to_step_id, job.data);
          } else {
            // No matching branch -- mark execution as complete
            await markExecutionComplete(executionId, organizationId);
          }

          // Mark step as completed
          await db()
            .update(step_executions)
            .set({ status: 'completed', completed_at: new Date(), result })
            .where(eq(step_executions.id, stepExec.id));

          await redis.setex(idempotencyKey, 86400 * 7, '1');

          logger.info({ executionId, stepId, branch: branchLabel }, 'Condition/split step executed');
          return { success: true, type: step.type, ...result };
        }

        default: {
          // Unknown step type or "exit" -- complete execution
          await db()
            .update(step_executions)
            .set({ status: 'completed', completed_at: new Date(), result: { type: step.type } })
            .where(eq(step_executions.id, stepExec.id));

          await markExecutionComplete(executionId, organizationId);

          await redis.setex(idempotencyKey, 86400 * 7, '1');

          logger.info({ executionId, stepId }, 'Exit/unknown step -- execution complete');
          return { success: true, type: 'exit' };
        }
      }

      // 7. Mark step as completed
      await db()
        .update(step_executions)
        .set({ status: 'completed', completed_at: new Date(), result })
        .where(eq(step_executions.id, stepExec.id));

      // 8. Find and enqueue next step(s)
      const connections = await db()
        .select()
        .from(journey_step_connections)
        .where(eq(journey_step_connections.from_step_id, stepId));

      if (connections.length > 0) {
        for (const conn of connections) {
          await enqueueNextStep(conn.to_step_id, job.data);
        }
      } else {
        // No more steps -- mark execution as complete
        await markExecutionComplete(executionId, organizationId);
      }

      // 9. Set idempotency key
      await redis.setex(idempotencyKey, 86400 * 7, '1');

      // 10. Log execution
      await db()
        .insert(execution_logs)
        .values({
          execution_id: executionId,
          organization_id: organizationId,
          level: 'info',
          message: `Step executed: ${step.type}`,
          metadata: { stepId, result },
        });

      logger.info({ jobId: job.id, executionId, stepId, type: step.type }, 'Journey step executed successfully');
      return { success: true, executionId, stepId, type: step.type, ...result };
    } catch (error) {
      // Mark step as failed
      await db()
        .update(step_executions)
        .set({
          status: 'failed',
          completed_at: new Date(),
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(step_executions.id, stepExec.id));

      await db()
        .insert(execution_logs)
        .values({
          execution_id: executionId,
          organization_id: organizationId,
          level: 'error',
          message: `Step failed: ${error instanceof Error ? error.message : String(error)}`,
          metadata: { stepId },
        });

      logger.error({ jobId: job.id, error, executionId, stepId }, 'Journey step execution failed');
      throw error;
    }
  },
};

// ============================================================================
// Delayed step handler
// ============================================================================

const delayedStepHandler: JobHandler<StepExecutionData> = {
  name: 'journey:delayed-steps',
  concurrency: 5,
  async process(job: Job<StepExecutionData>) {
    const { executionId, stepId, organizationId, journeyId, contactId, versionId } = job.data;

    logger.info({ executionId, stepId }, 'Processing delayed step wake-up');

    // Check if execution is still active
    const [execution] = await db()
      .select()
      .from(journey_executions)
      .where(
        and(
          eq(journey_executions.id, executionId),
          eq(journey_executions.organization_id, organizationId),
        ),
      );

    if (!execution || execution.status !== 'active') {
      logger.info({ executionId }, 'Execution no longer active after delay');
      return { success: false, reason: 'execution_not_active' };
    }

    // Find next step(s) after the delay step
    const connections = await db()
      .select()
      .from(journey_step_connections)
      .where(eq(journey_step_connections.from_step_id, stepId));

    if (connections.length > 0) {
      for (const conn of connections) {
        await enqueueNextStep(conn.to_step_id, {
          executionId,
          stepId,
          journeyId,
          contactId,
          organizationId,
          versionId,
        });
      }
    } else {
      await markExecutionComplete(executionId, organizationId);
    }

    logger.info({ executionId, stepId }, 'Delayed step wake-up processed');
    return { success: true };
  },
};

// ============================================================================
// Gate listener handler
// ============================================================================

interface GateListenerData {
  executionId: string;
  stepId: string;
  organizationId: string;
  journeyId: string;
  contactId: string;
  versionId: string;
  gateEventType: string;
}

const gateListenerHandler: JobHandler<GateListenerData> = {
  name: 'journey:gate-listeners',
  concurrency: 5,
  async process(job: Job<GateListenerData>) {
    const { executionId, stepId, organizationId, gateEventType } = job.data;

    logger.info({ executionId, stepId, gateEventType }, 'Processing gate listener match');

    // Verify execution is still active
    const [execution] = await db()
      .select()
      .from(journey_executions)
      .where(
        and(
          eq(journey_executions.id, executionId),
          eq(journey_executions.organization_id, organizationId),
        ),
      );

    if (!execution || execution.status !== 'active') {
      return { success: false, reason: 'execution_not_active' };
    }

    // Find next step(s) after the gate step
    const connections = await db()
      .select()
      .from(journey_step_connections)
      .where(eq(journey_step_connections.from_step_id, stepId));

    if (connections.length > 0) {
      for (const conn of connections) {
        await enqueueNextStep(conn.to_step_id, job.data);
      }
    } else {
      await markExecutionComplete(executionId, organizationId);
    }

    logger.info({ executionId, stepId }, 'Gate listener processed');
    return { success: true };
  },
};

// ============================================================================
// Scheduled Jobs
// ============================================================================

const segmentTriggerEvalHandler: JobHandler = {
  name: 'journey:segment-trigger-eval',
  concurrency: 1,
  async process(_job: Job) {
    logger.info('Evaluating segment triggers for active journeys');

    // Find all active journeys (across all orgs) with segment triggers
    // This is a system-level scheduled job
    const { journey_triggers, journeys } = await import('@mauntic/journey-domain/drizzle');

    const segmentTriggers = await db()
      .select()
      .from(journey_triggers)
      .where(eq(journey_triggers.type, 'segment'));

    let evaluated = 0;
    for (const trigger of segmentTriggers) {
      // Check if the journey is active
      const [journey] = await db()
        .select()
        .from(journeys)
        .where(
          and(
            eq(journeys.id, trigger.journey_id),
            eq(journeys.status, 'active'),
          ),
        );

      if (!journey) continue;

      // The segment evaluation logic would check the CRM segment for newly
      // matching contacts and start executions. This is a placeholder for the
      // actual segment membership query which depends on the CRM domain.
      const config = trigger.config as Record<string, unknown>;
      logger.info(
        { journeyId: journey.id, segmentId: config.segmentId },
        'Segment trigger evaluation placeholder',
      );
      evaluated++;
    }

    logger.info({ evaluated }, 'Segment trigger evaluation complete');
    return { success: true, evaluated };
  },
};

const staleExecutionCleanupHandler: JobHandler = {
  name: 'journey:stale-execution-cleanup',
  concurrency: 1,
  async process(_job: Job) {
    logger.info('Cleaning up stale executions');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find and cancel executions stuck for more than 7 days
    const staleExecutions = await db()
      .select()
      .from(journey_executions)
      .where(
        and(
          eq(journey_executions.status, 'active'),
          lt(journey_executions.started_at, sevenDaysAgo),
        ),
      );

    let canceled = 0;
    for (const exec of staleExecutions) {
      await db()
        .update(journey_executions)
        .set({
          status: 'canceled',
          completed_at: new Date(),
        })
        .where(eq(journey_executions.id, exec.id));

      await db()
        .insert(execution_logs)
        .values({
          execution_id: exec.id,
          organization_id: exec.organization_id,
          level: 'warn',
          message: 'Execution canceled due to staleness (stuck > 7 days)',
        });

      canceled++;
    }

    logger.info({ canceled, total: staleExecutions.length }, 'Stale execution cleanup complete');
    return { success: true, canceled };
  },
};

// ============================================================================
// Helpers
// ============================================================================

async function executeActionStep(
  config: Record<string, unknown>,
  data: StepExecutionData,
): Promise<Record<string, unknown>> {
  const action = config.action as string;

  switch (action) {
    case 'send_email': {
      const templateId = config.templateId as number ?? 0;
      await deliverySendEmailQueue.add('send-email', {
        organizationId: data.organizationId,
        contactId: data.contactId,
        templateId,
        journeyExecutionId: data.executionId,
        stepId: data.stepId,
        channel: 'email',
        idempotencyKey: `journey:${data.executionId}:${data.stepId}`,
      });
      return { action: 'send_email', templateId, enqueued: true };
    }

    case 'send_sms': {
      const templateId = config.templateId as number ?? 0;
      await deliverySendEmailQueue.add('send-sms', {
        organizationId: data.organizationId,
        contactId: data.contactId,
        templateId,
        journeyExecutionId: data.executionId,
        stepId: data.stepId,
        channel: 'sms',
        idempotencyKey: `journey:${data.executionId}:${data.stepId}`,
      });
      return { action: 'send_sms', templateId, enqueued: true };
    }

    case 'add_tag':
    case 'remove_tag':
    case 'update_field':
    case 'webhook':
      // Placeholder -- these would call the CRM ACL or webhook service
      logger.info({ action, executionId: data.executionId }, 'Action step placeholder');
      return { action, placeholder: true };

    default:
      logger.warn({ action }, 'Unknown action type');
      return { action, unknown: true };
  }
}

function calculateDelayMs(config: Record<string, unknown>): number {
  const duration = Number(config.duration) || 1;
  const unit = (config.unit as string) || 'hours';

  switch (unit) {
    case 'minutes':
      return duration * 60 * 1000;
    case 'hours':
      return duration * 60 * 60 * 1000;
    case 'days':
      return duration * 24 * 60 * 60 * 1000;
    default:
      return duration * 60 * 60 * 1000; // Default to hours
  }
}

function evaluateCondition(
  config: Record<string, unknown>,
  _data: StepExecutionData,
): string {
  // Placeholder condition evaluation.
  // In a full implementation this would evaluate the expression against
  // the contact's data from the CRM ACL.
  const expression = config.expression as string;
  if (!expression) return 'yes';

  // Simple placeholder: always returns 'yes'
  // The real implementation would use the split evaluator domain service
  return 'yes';
}

async function enqueueNextStep(
  nextStepId: string,
  sourceData: StepExecutionData,
): Promise<void> {
  const stepQueue = createQueue('journey:execute-step');
  await stepQueue.add('execute-step', {
    ...sourceData,
    stepId: nextStepId,
  });
}

async function markExecutionComplete(
  executionId: string,
  organizationId: string,
): Promise<void> {
  await db()
    .update(journey_executions)
    .set({
      status: 'completed',
      completed_at: new Date(),
    })
    .where(
      and(
        eq(journey_executions.id, executionId),
        eq(journey_executions.organization_id, organizationId),
      ),
    );

  await db()
    .insert(execution_logs)
    .values({
      execution_id: executionId,
      organization_id: organizationId,
      level: 'info',
      message: 'Journey execution completed',
    });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  // Create workers for all queues
  const stepWorker = createWorker('journey:execute-step', journeyStepHandler);
  const delayedWorker = createWorker('journey:delayed-steps', delayedStepHandler);
  const gateWorker = createWorker('journey:gate-listeners', gateListenerHandler);

  // Create workers for scheduled jobs
  const segmentWorker = createWorker('journey:segment-trigger-eval', segmentTriggerEvalHandler);
  const cleanupWorker = createWorker('journey:stale-execution-cleanup', staleExecutionCleanupHandler);

  // Register scheduled jobs
  const scheduledJobs: ScheduledJob[] = [
    {
      name: 'segment-trigger-eval',
      pattern: '0 * * * *', // Every hour
      data: { type: 'segment-trigger-eval' },
    },
    {
      name: 'stale-execution-cleanup',
      pattern: '0 3 * * *', // Daily at 3 AM
      data: { type: 'stale-execution-cleanup' },
    },
  ];

  await registerScheduledJobs('journey:segment-trigger-eval', [scheduledJobs[0]]);
  await registerScheduledJobs('journey:stale-execution-cleanup', [scheduledJobs[1]]);

  // Event handlers
  const workers = [stepWorker, delayedWorker, gateWorker, segmentWorker, cleanupWorker];

  for (const worker of workers) {
    worker.on('completed', (job) => {
      logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
    });

    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, error: err }, 'Job failed');
    });
  }

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all(workers.map((w) => w.close()));
    const redis = getRedis();
    await redis.quit();
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Journey executor service started with all queues');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});

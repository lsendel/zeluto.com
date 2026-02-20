import { Result } from '@mauntic/domain-kernel';
import { type JourneyExecution, StepExecution } from '@mauntic/journey-domain';
import type { Queue } from 'bullmq';
import pino from 'pino';
import type { IJourneyRepository } from '../infrastructure/repositories/drizzle-journey-repository.js';

const logger = pino({ name: 'journey-service' });

export class JourneyService {
  constructor(
    private readonly journeyRepo: IJourneyRepository,
    private readonly emailQueue: Queue,
    private readonly delayedStepQueue: Queue,
    private readonly stepQueue: Queue,
    private readonly redis: any, // Redis client
  ) {}

  async executeStep(data: {
    executionId: string;
    stepId: string;
    journeyId: string;
    contactId: string;
    organizationId: string;
    versionId: string;
    jobId?: string;
  }): Promise<Result<void>> {
    const { executionId, stepId, organizationId } = data;
    logger.info({ executionId, stepId }, 'Executing step');

    // Idempotency check
    const idempotencyKey = `step-exec:${executionId}:${stepId}`;
    const alreadyProcessed = await this.redis.get(idempotencyKey);
    if (alreadyProcessed) {
      logger.info(
        { executionId, stepId },
        'Step already processed (idempotent skip)',
      );
      return Result.ok();
    }

    const execution = await this.journeyRepo.findExecutionById(
      executionId,
      organizationId,
    );
    if (!execution || execution.status !== 'active') {
      logger.warn({ executionId }, 'Execution not found or not active');
      return Result.fail('Execution not found or not active');
    }

    const step = await this.journeyRepo.findStepById(stepId, organizationId);
    if (!step) {
      logger.warn({ stepId }, 'Step not found');
      return Result.fail('Step not found');
    }

    // Create step execution
    const stepExecResult = StepExecution.create({
      executionId,
      stepId,
      organizationId,
    });
    const stepExec = stepExecResult.getValue();
    stepExec.start();
    await this.journeyRepo.createStepExecution(stepExec);

    // Update journey execution current step
    execution.moveToStep(stepId);
    await this.journeyRepo.saveExecution(execution);

    try {
      const config = step.config;
      let result: Record<string, unknown> = {};

      switch (step.type) {
        case 'action': {
          result = await this.executeAction(config, data);
          break;
        }
        case 'delay': {
          const delayMs = this.calculateDelayMs(config);
          await this.delayedStepQueue.add(
            'delayed-wake',
            { ...data },
            { delay: delayMs },
          );
          result = { delayMs };
          // For caching, we set a long expiry so we don't re-execute immediately
          await this.redis.setex(idempotencyKey, 86400 * 7, '1');

          stepExec.complete(result);
          await this.journeyRepo.updateStepExecution(stepExec);
          await this.journeyRepo.logExecution(
            executionId,
            organizationId,
            'info',
            `Delay step scheduled: ${delayMs}ms`,
            { stepId, delayMs },
          );

          return Result.ok(); // Don't enqueue next step yet
        }
        case 'condition':
        case 'split': {
          const branchLabel = this.evaluateCondition(config, data); // Simplified data passed
          result = { branch: branchLabel };

          // Find connection matching branch
          const connections =
            await this.journeyRepo.findConnectionsFrom(stepId);
          const matchingConn =
            connections.find((c) => c.label === branchLabel) ?? connections[0];

          if (matchingConn) {
            await this.enqueueNextStep(matchingConn.toStepId, data);
          } else {
            await this.completeExecution(execution);
          }
          break;
        }
        default: {
          // Exit or unknown
          result = { type: step.type };
          await this.completeExecution(execution);
          break;
        }
      }

      stepExec.complete(result);
      await this.journeyRepo.updateStepExecution(stepExec);

      // If not delay/split/unknown handled above, proceed to next
      if (step.type === 'action' || step.type === 'trigger') {
        // Trigger only if starting? but executeStep handles triggers too? No triggers start execution.
        const connections = await this.journeyRepo.findConnectionsFrom(stepId);
        if (connections.length > 0) {
          for (const conn of connections) {
            await this.enqueueNextStep(conn.toStepId, data);
          }
        } else {
          await this.completeExecution(execution);
        }
      }

      await this.redis.setex(idempotencyKey, 86400 * 7, '1');
      await this.journeyRepo.logExecution(
        executionId,
        organizationId,
        'info',
        `Step executed: ${step.type}`,
        { stepId, result },
      );

      return Result.ok();
    } catch (err: any) {
      stepExec.fail(err.message || String(err));
      await this.journeyRepo.updateStepExecution(stepExec);
      await this.journeyRepo.logExecution(
        executionId,
        organizationId,
        'error',
        `Step failed: ${err.message}`,
        { stepId },
      );
      throw err;
    }
  }

  async processDelayedStep(data: {
    executionId: string;
    stepId: string;
    organizationId: string;
  }): Promise<Result<void>> {
    const { executionId, stepId, organizationId } = data;
    const execution = await this.journeyRepo.findExecutionById(
      executionId,
      organizationId,
    );

    if (!execution || execution.status !== 'active') {
      return Result.fail('Execution not active');
    }

    const connections = await this.journeyRepo.findConnectionsFrom(stepId);
    if (connections.length > 0) {
      for (const conn of connections) {
        await this.enqueueNextStep(conn.toStepId, data as any);
      }
    } else {
      await this.completeExecution(execution);
    }
    return Result.ok();
  }

  async cleanupStaleExecutions(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleExecs = await this.journeyRepo.findStaleExecutions(sevenDaysAgo);

    for (const exec of staleExecs) {
      exec.cancel();
      await this.journeyRepo.saveExecution(exec);
      await this.journeyRepo.logExecution(
        exec.executionId,
        exec.organizationId,
        'warn',
        'Execution canceled due to staleness (stuck > 7 days)',
      );
    }
  }

  async evaluateScoreTriggers(
    organizationId: string,
    contactId: string,
    score: number,
    eventType: 'LeadScored' | 'IntentSignalDetected',
    signalType?: string,
  ): Promise<void> {
    const triggerType =
      eventType === 'LeadScored' ? 'score_threshold' : 'intent_signal';

    const triggers = await this.journeyRepo.findTriggersByType(
      organizationId,
      triggerType,
    );

    for (const { trigger, journey } of triggers) {
      const config = trigger.config;

      if (triggerType === 'score_threshold') {
        const minScore = (config.minScore as number) ?? 80;
        const direction = (config.direction as string) ?? 'up';

        if (direction === 'up' && score >= minScore) {
          // Check if contact already active in journey
          const existingExecution = await this.journeyRepo.findActiveExecution(
            organizationId,
            journey.journeyId,
            contactId,
          );

          if (existingExecution) {
            logger.info(
              { journeyId: journey.journeyId, contactId, executionId: existingExecution.id },
              'Contact already active in journey, skipping trigger',
            );
            continue;
          }

          logger.info(
            { journeyId: journey.journeyId, contactId, score },
            'Score threshold trigger fired — creating execution',
          );
        }
      } else if (triggerType === 'intent_signal') {
        const targetSignalType = config.signalType as string;
        if (!targetSignalType || targetSignalType === signalType) {
          logger.info(
            { journeyId: journey.journeyId, contactId, signalType },
            'Intent signal trigger fired',
          );
        }
      }
    }
  }

  async evaluateSegmentTriggers(): Promise<void> {
    const triggers =
      await this.journeyRepo.findActiveJourneysWithSegmentTriggers();
    for (const { trigger, journey } of triggers) {
      const config = trigger.config;
      logger.info(
        { journeyId: journey.journeyId, segmentId: config.segmentId },
        'Segment trigger evaluation placeholder',
      );
    }
  }

  // --- Private Helpers ---

  private async executeAction(
    config: Record<string, unknown>,
    data: any,
  ): Promise<Record<string, unknown>> {
    const action = config.action as string;
    const channelMap: Record<string, string> = {
      send_email: 'email',
      send_sms: 'sms',
      send_push: 'push',
    };
    const channel = channelMap[action];

    if (channel) {
      const templateId = (config.templateId as number) ?? 0;
      await this.emailQueue.add(action.replace('send_', 'send-'), {
        organizationId: data.organizationId,
        contactId: data.contactId,
        templateId,
        journeyExecutionId: data.executionId,
        stepId: data.stepId,
        channel,
        idempotencyKey: `journey:${data.executionId}:${data.stepId}`,
      });
      return { action, templateId, enqueued: true };
    }

    return { action, placeholder: true };
  }

  private calculateDelayMs(config: Record<string, unknown>): number {
    const duration = Number(config.duration) || 1;
    const unit = (config.unit as string) || 'hours';
    switch (unit) {
      case 'minutes':
        return duration * 60 * 1000;
      case 'hours':
        return duration * 3600 * 1000;
      case 'days':
        return duration * 86400 * 1000;
      default:
        return duration * 3600 * 1000;
    }
  }

  private evaluateCondition(
    config: Record<string, unknown>,
    _data?: any,
  ): string {
    // Basic logic mapping from original index.ts
    // In a real refactor, this should be more robust
    const conditionType = config.type as string;
    if (conditionType === 'score_range') {
      return 'default'; // Simplification for now
    }
    if (conditionType === 'lead_grade') {
      const grades = (config.config as any)?.grades as Record<string, string>;
      return grades?.default ?? 'default';
    }
    return 'yes';
  }

  private async enqueueNextStep(nextStepId: string, data: any): Promise<void> {
    await this.stepQueue.add('execute-step', {
      ...data,
      stepId: nextStepId,
    });
  }

  private async completeExecution(execution: JourneyExecution): Promise<void> {
    execution.complete();
    await this.journeyRepo.saveExecution(execution);
    await this.journeyRepo.logExecution(
      execution.executionId,
      execution.organizationId,
      'info',
      'Journey execution completed',
    );
  }
}

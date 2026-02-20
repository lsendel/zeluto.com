import type { DomainEvent } from '@mauntic/domain-kernel';
import type { JourneyExecution } from '../entities/journey-execution.js';
import type { JourneyStep } from '../entities/journey-step.js';
import {
  evaluateConditionSplit,
  evaluateRandomSplit,
} from '../services/split-evaluator.js';
import type {
  DelayDurationConfig,
  SplitConditionConfig,
  SplitRandomConfig,
} from '../value-objects/step-configs.js';

export interface StepExecutionContext {
  execution: JourneyExecution;
  step: JourneyStep;
  contactData: Record<string, unknown>;
  connections: Array<{ fromStepId: string; toStepId: string; label?: string }>;
}

export interface StepExecutionResult {
  nextStepIds: string[]; // 0 for exit, 1 for linear, 2+ for split
  events: DomainEvent[]; // events to publish
  delayMs?: number; // for delay steps
}

/**
 * Core orchestration: given a step and execution context, determine the action
 * to take and which step(s) to proceed to next.
 */
export function executeStep(ctx: StepExecutionContext): StepExecutionResult {
  switch (ctx.step.type) {
    case 'action':
      return executeAction(ctx);
    case 'delay':
      return executeDelay(ctx);
    case 'split':
      return executeSplit(ctx);
    case 'condition':
      return executeCondition(ctx);
    case 'exit':
      return { nextStepIds: [], events: [] };
    case 'trigger':
      // Trigger steps pass through to the next connected step
      return executePassthrough(ctx);
    default:
      return { nextStepIds: [], events: [] };
  }
}

function executeAction(ctx: StepExecutionContext): StepExecutionResult {
  const outgoing = ctx.connections.filter((c) => c.fromStepId === ctx.step.id);
  const nextStepIds = outgoing.map((c) => c.toStepId);

  const events: DomainEvent[] = [
    {
      type: 'journey.StepExecuted',
      data: {
        organizationId: Number(ctx.execution.organizationId),
        journeyId: Number(ctx.execution.journeyId),
        executionId: ctx.execution.id,
        stepId: ctx.step.id,
        stepType: ctx.step.type,
        contactId: Number(ctx.execution.contactId),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: ctx.execution.id,
        tenantContext: { organizationId: Number(ctx.execution.organizationId) },
      },
    },
  ];

  return { nextStepIds, events };
}

function executeDelay(ctx: StepExecutionContext): StepExecutionResult {
  const config = ctx.step.config as unknown as DelayDurationConfig;
  const outgoing = ctx.connections.filter((c) => c.fromStepId === ctx.step.id);
  const nextStepIds = outgoing.map((c) => c.toStepId);

  let delayMs = 0;
  const duration = config.duration ?? 0;
  const unit = config.unit ?? 'minutes';

  switch (unit) {
    case 'minutes':
      delayMs = duration * 60 * 1000;
      break;
    case 'hours':
      delayMs = duration * 60 * 60 * 1000;
      break;
    case 'days':
      delayMs = duration * 24 * 60 * 60 * 1000;
      break;
  }

  return { nextStepIds, events: [], delayMs };
}

function executeSplit(ctx: StepExecutionContext): StepExecutionResult {
  const config = ctx.step.config as Record<string, unknown>;
  const outgoing = ctx.connections.filter((c) => c.fromStepId === ctx.step.id);

  if (config.type === 'split_random') {
    const randomConfig = config as unknown as SplitRandomConfig;
    const winningLabel = evaluateRandomSplit(randomConfig.branches);
    const matched = outgoing.find((c) => c.label === winningLabel);
    return {
      nextStepIds: matched ? [matched.toStepId] : [],
      events: [],
    };
  }

  // Default: follow all branches (fan-out)
  return {
    nextStepIds: outgoing.map((c) => c.toStepId),
    events: [],
  };
}

function executeCondition(ctx: StepExecutionContext): StepExecutionResult {
  const config = ctx.step.config as unknown as SplitConditionConfig;
  const outgoing = ctx.connections.filter((c) => c.fromStepId === ctx.step.id);

  const conditionMet = evaluateConditionSplit(
    config.field,
    config.operator,
    config.value,
    ctx.contactData,
  );

  const matchLabel = conditionMet ? 'yes' : 'no';
  const matched = outgoing.find((c) => c.label === matchLabel);

  return {
    nextStepIds: matched ? [matched.toStepId] : [],
    events: [],
  };
}

function executePassthrough(ctx: StepExecutionContext): StepExecutionResult {
  const outgoing = ctx.connections.filter((c) => c.fromStepId === ctx.step.id);
  return {
    nextStepIds: outgoing.map((c) => c.toStepId),
    events: [],
  };
}

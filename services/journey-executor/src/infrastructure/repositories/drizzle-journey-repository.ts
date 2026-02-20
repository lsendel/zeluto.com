import {
  Journey,
  JourneyExecution,
  JourneyStep,
  JourneyTrigger,
  type StepExecution,
} from '@mauntic/journey-domain';
import {
  execution_logs,
  journey_executions,
  journey_step_connections,
  journey_steps,
  journey_triggers,
  journeys,
  step_executions,
} from '@mauntic/journey-domain/drizzle';
import { and, eq, lt } from 'drizzle-orm';

export interface IJourneyRepository {
  findExecutionById(
    executionId: string,
    organizationId: string,
  ): Promise<JourneyExecution | null>;
  saveExecution(execution: JourneyExecution): Promise<void>;

  findStepById(
    stepId: string,
    organizationId: string,
  ): Promise<JourneyStep | null>;
  findConnectionsFrom(
    stepId: string,
  ): Promise<Array<{ fromStepId: string; toStepId: string; label?: string }>>;

  createStepExecution(stepExecution: StepExecution): Promise<void>;
  updateStepExecution(stepExecution: StepExecution): Promise<void>;

  findTriggersByType(
    organizationId: string,
    type: 'score_threshold' | 'intent_signal',
  ): Promise<Array<{ trigger: JourneyTrigger; journey: Journey }>>;
  findActiveJourneysWithSegmentTriggers(): Promise<
    Array<{ trigger: JourneyTrigger; journey: Journey }>
  >;

  findStaleExecutions(olderThan: Date): Promise<JourneyExecution[]>;

  logExecution(
    executionId: string,
    organizationId: string,
    level: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

export class DrizzleJourneyRepository implements IJourneyRepository {
  constructor(private readonly db: any) {}

  async findExecutionById(
    executionId: string,
    organizationId: string,
  ): Promise<JourneyExecution | null> {
    const [row] = await this.db
      .select()
      .from(journey_executions)
      .where(
        and(
          eq(journey_executions.id, executionId),
          eq(journey_executions.organization_id, organizationId),
        ),
      );

    if (!row) return null;

    return JourneyExecution.reconstitute({
      id: row.id,
      journeyId: row.journey_id,
      journeyVersionId: row.journey_version_id,
      organizationId: row.organization_id,
      contactId: row.contact_id,
      status: row.status as any,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      currentStepId: row.current_step_id,
    }).getValue();
  }

  async saveExecution(execution: JourneyExecution): Promise<void> {
    const props = execution.toProps();
    await this.db
      .update(journey_executions)
      .set({
        status: props.status,
        completed_at: props.completedAt,
        current_step_id: props.currentStepId,
      })
      .where(eq(journey_executions.id, props.id));

    // Domain events dispatching would ideally happen here or in service
  }

  async findStepById(
    stepId: string,
    organizationId: string,
  ): Promise<JourneyStep | null> {
    const [row] = await this.db
      .select()
      .from(journey_steps)
      .where(
        and(
          eq(journey_steps.id, stepId),
          eq(journey_steps.organization_id, organizationId),
        ),
      );

    if (!row) return null;

    return JourneyStep.reconstitute({
      id: row.id,
      journeyVersionId: row.journey_version_id,
      organizationId: row.organization_id,
      type: row.type as any,
      config: row.config as Record<string, unknown>,
      positionX: row.position_x,
      positionY: row.position_y,
    }).getValue();
  }

  async findConnectionsFrom(
    stepId: string,
  ): Promise<Array<{ fromStepId: string; toStepId: string; label?: string }>> {
    const rows = await this.db
      .select()
      .from(journey_step_connections)
      .where(eq(journey_step_connections.from_step_id, stepId));

    return rows.map((row: any) => ({
      fromStepId: row.from_step_id,
      toStepId: row.to_step_id,
      label: row.label || undefined,
    }));
  }

  async createStepExecution(stepExecution: StepExecution): Promise<void> {
    const props = stepExecution.toProps();
    await this.db.insert(step_executions).values({
      id: props.id,
      execution_id: props.executionId,
      step_id: props.stepId,
      organization_id: props.organizationId,
      status: props.status,
      started_at: props.startedAt,
      completed_at: props.completedAt,
      result: props.result,
      error: props.error,
    });
  }

  async updateStepExecution(stepExecution: StepExecution): Promise<void> {
    const props = stepExecution.toProps();
    await this.db
      .update(step_executions)
      .set({
        status: props.status,
        completed_at: props.completedAt,
        result: props.result,
        error: props.error,
      })
      .where(eq(step_executions.id, props.id));
  }

  async findTriggersByType(
    organizationId: string,
    type: 'score_threshold' | 'intent_signal',
  ): Promise<Array<{ trigger: JourneyTrigger; journey: Journey }>> {
    const rows = await this.db
      .select({
        trigger: journey_triggers,
        journey: journeys,
      })
      .from(journey_triggers)
      .innerJoin(journeys, eq(journeys.id, journey_triggers.journey_id))
      .where(
        and(
          eq(journey_triggers.organization_id, organizationId),
          eq(journey_triggers.type, type),
          eq(journeys.status, 'active'),
        ),
      );

    return rows.map(({ trigger, journey }: any) => ({
      trigger: JourneyTrigger.reconstitute({
        id: trigger.id,
        journeyId: trigger.journey_id,
        organizationId: trigger.organization_id,
        type: trigger.type as any,
        config: trigger.config as Record<string, unknown>,
      }).getValue(),
      journey: Journey.reconstitute({
        id: journey.id,
        organizationId: journey.organization_id,
        name: journey.name,
        description: journey.description,
        status: journey.status as any,
        createdBy: journey.created_by,
        createdAt: journey.created_at,
        updatedAt: journey.updated_at,
      }).getValue(),
    }));
  }

  async findActiveJourneysWithSegmentTriggers(): Promise<
    Array<{ trigger: JourneyTrigger; journey: Journey }>
  > {
    // This is a bit inefficient if there are many triggers, but for now matches existing logic
    // Ideally we filter by active journey first
    const rows = await this.db
      .select({
        trigger: journey_triggers,
        journey: journeys,
      })
      .from(journey_triggers)
      .innerJoin(journeys, eq(journeys.id, journey_triggers.journey_id))
      .where(
        and(
          eq(journey_triggers.type, 'segment'),
          eq(journeys.status, 'active'),
        ),
      );

    return rows.map(({ trigger, journey }: any) => ({
      trigger: JourneyTrigger.reconstitute({
        id: trigger.id,
        journeyId: trigger.journey_id,
        organizationId: trigger.organization_id,
        type: trigger.type as any,
        config: trigger.config as Record<string, unknown>,
      }).getValue(),
      journey: Journey.reconstitute({
        id: journey.id,
        organizationId: journey.organization_id,
        name: journey.name,
        description: journey.description,
        status: journey.status as any,
        createdBy: journey.created_by,
        createdAt: journey.created_at,
        updatedAt: journey.updated_at,
      }).getValue(),
    }));
  }

  async findStaleExecutions(olderThan: Date): Promise<JourneyExecution[]> {
    const rows = await this.db
      .select()
      .from(journey_executions)
      .where(
        and(
          eq(journey_executions.status, 'active'),
          lt(journey_executions.started_at, olderThan),
        ),
      );

    return rows.map((row: any) =>
      JourneyExecution.reconstitute({
        id: row.id,
        journeyId: row.journey_id,
        journeyVersionId: row.journey_version_id,
        organizationId: row.organization_id,
        contactId: row.contact_id,
        status: row.status as any,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        currentStepId: row.current_step_id,
      }).getValue(),
    );
  }

  async logExecution(
    executionId: string,
    organizationId: string,
    level: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(execution_logs).values({
      execution_id: executionId,
      organization_id: organizationId,
      level,
      message,
      metadata,
    });
  }
}

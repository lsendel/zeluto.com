import {
  AggregateRoot,
  type OrganizationId,
  Result,
} from '@mauntic/domain-kernel';
import { z } from 'zod';

export const ExecutionStatusSchema = z.enum([
  'active',
  'completed',
  'failed',
  'canceled',
]);

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const JourneyExecutionPropsSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.string().uuid(),
  journeyVersionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  status: ExecutionStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  currentStepId: z.string().uuid().nullable(),
});

export type JourneyExecutionProps = z.infer<typeof JourneyExecutionPropsSchema>;

export class JourneyExecution extends AggregateRoot<JourneyExecutionProps> {
  private constructor(props: JourneyExecutionProps) {
    super(props.id, props);
  }

  // ---- Factory methods ----

  static create(input: {
    journeyId: string;
    journeyVersionId: string;
    organizationId: string;
    contactId: string;
  }): Result<JourneyExecution> {
    const id = crypto.randomUUID();
    const props = JourneyExecutionPropsSchema.parse({
      id,
      journeyId: input.journeyId,
      journeyVersionId: input.journeyVersionId,
      organizationId: input.organizationId,
      contactId: input.contactId,
      status: 'active',
      startedAt: new Date(),
      completedAt: null,
      currentStepId: null,
    });
    return Result.ok(new JourneyExecution(props));
  }

  static reconstitute(props: JourneyExecutionProps): Result<JourneyExecution> {
    return Result.ok(
      new JourneyExecution(JourneyExecutionPropsSchema.parse(props)),
    );
  }

  // ---- Accessors ----

  get executionId(): string {
    return this.id;
  }
  get journeyId(): string {
    return this.props.journeyId;
  }
  get journeyVersionId(): string {
    return this.props.journeyVersionId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get contactId(): string {
    return this.props.contactId;
  }
  get status(): ExecutionStatus {
    return this.props.status;
  }
  get startedAt(): Date {
    return this.props.startedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get currentStepId(): string | null {
    return this.props.currentStepId;
  }

  // ---- Domain methods ----

  moveToStep(stepId: string): Result<void> {
    if (this.props.status !== 'active') {
      return Result.fail(
        `Cannot move to step when execution status is "${this.props.status}"`,
      );
    }
    z.string().uuid().parse(stepId);

    // Capture previous for event if needed, but not in payload?
    const fromStepId = this.props.currentStepId;

    this.props.currentStepId = stepId;

    this.addDomainEvent({
      type: 'journey.ExecutionStepChanged',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.props.journeyId,
        executionId: this.id,
        contactId: this.props.contactId,
        fromStepId,
        toStepId: stepId,
        changedAt: new Date().toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  complete(): Result<void> {
    if (this.props.status !== 'active') {
      return Result.fail(
        `Cannot complete execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'completed';
    this.props.completedAt = new Date();

    this.addDomainEvent({
      type: 'journey.ExecutionCompleted',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.props.journeyId,
        executionId: this.id,
        contactId: this.props.contactId,
        completedAt: this.props.completedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  fail(reason: string): Result<void> {
    if (this.props.status !== 'active') {
      return Result.fail(
        `Cannot fail execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'failed';
    this.props.completedAt = new Date();

    this.addDomainEvent({
      type: 'journey.ExecutionFailed',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.props.journeyId,
        executionId: this.id,
        contactId: this.props.contactId,
        reason,
        failedAt: this.props.completedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  cancel(): Result<void> {
    if (this.props.status !== 'active') {
      return Result.fail(
        `Cannot cancel execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'canceled';
    this.props.completedAt = new Date();

    this.addDomainEvent({
      type: 'journey.ExecutionCanceled',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.props.journeyId,
        executionId: this.id,
        contactId: this.props.contactId,
        canceledAt: this.props.completedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyExecutionProps> {
    return Object.freeze({ ...this.props });
  }
}

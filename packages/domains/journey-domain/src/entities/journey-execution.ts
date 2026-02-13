import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

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

export class JourneyExecution {
  private constructor(private props: JourneyExecutionProps) {}

  // ---- Factory methods ----

  static create(input: {
    journeyId: string;
    journeyVersionId: string;
    organizationId: string;
    contactId: string;
  }): JourneyExecution {
    return new JourneyExecution(
      JourneyExecutionPropsSchema.parse({
        id: crypto.randomUUID(),
        journeyId: input.journeyId,
        journeyVersionId: input.journeyVersionId,
        organizationId: input.organizationId,
        contactId: input.contactId,
        status: 'active',
        startedAt: new Date(),
        completedAt: null,
        currentStepId: null,
      }),
    );
  }

  static reconstitute(props: JourneyExecutionProps): JourneyExecution {
    return new JourneyExecution(JourneyExecutionPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
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

  moveToStep(stepId: string): void {
    if (this.props.status !== 'active') {
      throw new InvariantViolation(
        `Cannot move to step when execution status is "${this.props.status}"`,
      );
    }
    z.string().uuid().parse(stepId);
    this.props.currentStepId = stepId;
  }

  complete(): void {
    if (this.props.status !== 'active') {
      throw new InvariantViolation(
        `Cannot complete execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'completed';
    this.props.completedAt = new Date();
  }

  fail(): void {
    if (this.props.status !== 'active') {
      throw new InvariantViolation(
        `Cannot fail execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'failed';
    this.props.completedAt = new Date();
  }

  cancel(): void {
    if (this.props.status !== 'active') {
      throw new InvariantViolation(
        `Cannot cancel execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'canceled';
    this.props.completedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyExecutionProps> {
    return Object.freeze({ ...this.props });
  }
}

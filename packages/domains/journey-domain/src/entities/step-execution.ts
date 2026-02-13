import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const StepExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export type StepExecutionStatus = z.infer<typeof StepExecutionStatusSchema>;

export const StepExecutionPropsSchema = z.object({
  id: z.string().uuid(),
  executionId: z.string().uuid(),
  stepId: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: StepExecutionStatusSchema,
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
});

export type StepExecutionProps = z.infer<typeof StepExecutionPropsSchema>;

export class StepExecution {
  private constructor(private props: StepExecutionProps) {}

  // ---- Factory methods ----

  static create(input: {
    executionId: string;
    stepId: string;
    organizationId: string;
  }): StepExecution {
    return new StepExecution(
      StepExecutionPropsSchema.parse({
        id: crypto.randomUUID(),
        executionId: input.executionId,
        stepId: input.stepId,
        organizationId: input.organizationId,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
      }),
    );
  }

  static reconstitute(props: StepExecutionProps): StepExecution {
    return new StepExecution(StepExecutionPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get executionId(): string {
    return this.props.executionId;
  }
  get stepId(): string {
    return this.props.stepId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get status(): StepExecutionStatus {
    return this.props.status;
  }
  get startedAt(): Date | null {
    return this.props.startedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get result(): Record<string, unknown> | null {
    return this.props.result;
  }
  get error(): string | null {
    return this.props.error;
  }

  // ---- Domain methods ----

  start(): void {
    if (this.props.status !== 'pending') {
      throw new InvariantViolation(
        `Cannot start step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'running';
    this.props.startedAt = new Date();
  }

  complete(result: Record<string, unknown>): void {
    if (this.props.status !== 'running') {
      throw new InvariantViolation(
        `Cannot complete step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'completed';
    this.props.result = result;
    this.props.completedAt = new Date();
  }

  fail(error: string): void {
    if (this.props.status !== 'running') {
      throw new InvariantViolation(
        `Cannot fail step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'failed';
    this.props.error = error;
    this.props.completedAt = new Date();
  }

  skip(): void {
    if (this.props.status !== 'pending') {
      throw new InvariantViolation(
        `Cannot skip step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'skipped';
    this.props.completedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<StepExecutionProps> {
    return Object.freeze({ ...this.props });
  }
}

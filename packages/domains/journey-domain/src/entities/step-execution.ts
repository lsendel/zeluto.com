import { z } from 'zod';
import { Entity, Result } from '@mauntic/domain-kernel';

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

export class StepExecution extends Entity<StepExecutionProps> {
  private constructor(props: StepExecutionProps) {
    super(props.id, props);
  }

  // ---- Factory methods ----

  static create(input: {
    executionId: string;
    stepId: string;
    organizationId: string;
  }): Result<StepExecution> {
    const id = crypto.randomUUID();
    const props = StepExecutionPropsSchema.parse({
      id,
      executionId: input.executionId,
      stepId: input.stepId,
      organizationId: input.organizationId,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    });
    return Result.ok(new StepExecution(props));
  }

  static reconstitute(props: StepExecutionProps): Result<StepExecution> {
    return Result.ok(new StepExecution(StepExecutionPropsSchema.parse(props)));
  }

  // ---- Accessors ----

  get stepExecutionId(): string {
    return this.id;
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

  start(): Result<void> {
    if (this.props.status !== 'pending') {
      return Result.fail(
        `Cannot start step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'running';
    this.props.startedAt = new Date();
    return Result.ok();
  }

  complete(result: Record<string, unknown>): Result<void> {
    if (this.props.status !== 'running') {
      return Result.fail(
        `Cannot complete step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'completed';
    this.props.result = result;
    this.props.completedAt = new Date();
    return Result.ok();
  }

  fail(error: string): Result<void> {
    if (this.props.status !== 'running') {
      return Result.fail(
        `Cannot fail step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'failed';
    this.props.error = error;
    this.props.completedAt = new Date();
    return Result.ok();
  }

  skip(): Result<void> {
    if (this.props.status !== 'pending') {
      return Result.fail(
        `Cannot skip step execution from status "${this.props.status}"`,
      );
    }
    this.props.status = 'skipped';
    this.props.completedAt = new Date();
    return Result.ok();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<StepExecutionProps> {
    return Object.freeze({ ...this.props });
  }
}

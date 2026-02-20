import { z } from 'zod';

export const SyncDirectionSchema = z.enum(['inbound', 'outbound']);
export type SyncDirection = z.infer<typeof SyncDirectionSchema>;

export const SyncStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const SyncJobPropsSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  direction: SyncDirectionSchema,
  status: SyncStatusSchema,
  recordsSynced: z.number().default(0),
  errors: z.array(z.string()).default([]),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
});

export type SyncJobProps = z.infer<typeof SyncJobPropsSchema>;

export class SyncJob {
  private constructor(private props: SyncJobProps) {}

  static create(input: {
    connectionId: string;
    organizationId: string;
    direction: SyncDirection;
  }): SyncJob {
    return new SyncJob(
      SyncJobPropsSchema.parse({
        id: crypto.randomUUID(),
        connectionId: input.connectionId,
        organizationId: input.organizationId,
        direction: input.direction,
        status: 'pending',
        recordsSynced: 0,
        errors: [],
        startedAt: null,
        completedAt: null,
      }),
    );
  }

  static reconstitute(props: SyncJobProps): SyncJob {
    return new SyncJob(SyncJobPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get connectionId(): string {
    return this.props.connectionId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get direction(): SyncDirection {
    return this.props.direction;
  }
  get status(): SyncStatus {
    return this.props.status;
  }
  get recordsSynced(): number {
    return this.props.recordsSynced;
  }
  get errors(): string[] {
    return this.props.errors;
  }
  get startedAt(): Date | null {
    return this.props.startedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  start(): void {
    this.props.status = 'running';
    this.props.startedAt = new Date();
  }

  complete(recordsSynced: number): void {
    this.props.status = 'completed';
    this.props.recordsSynced = recordsSynced;
    this.props.completedAt = new Date();
  }

  fail(error: string): void {
    this.props.status = 'failed';
    this.props.errors = [...this.props.errors, error];
    this.props.completedAt = new Date();
  }

  addError(error: string): void {
    this.props.errors = [...this.props.errors, error];
  }

  incrementRecords(count: number): void {
    this.props.recordsSynced += count;
  }

  toProps(): Readonly<SyncJobProps> {
    return Object.freeze({ ...this.props });
  }
}

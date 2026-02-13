import { z } from 'zod';

export const ReportTypeSchema = z.enum([
  'contact_growth',
  'email_performance',
  'campaign_comparison',
  'revenue',
]);

export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: ReportTypeSchema,
  config: z.record(z.string(), z.unknown()),
  lastRunAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ReportProps = z.infer<typeof ReportPropsSchema>;

export class Report {
  private constructor(private props: ReportProps) {}

  static create(input: {
    organizationId: string;
    name: string;
    type: ReportType;
    config?: Record<string, unknown>;
  }): Report {
    return new Report(
      ReportPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        config: input.config ?? {},
        lastRunAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ReportProps): Report {
    return new Report(ReportPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get type(): ReportType {
    return this.props.type;
  }
  get config(): Record<string, unknown> {
    return this.props.config;
  }
  get lastRunAt(): Date | null {
    return this.props.lastRunAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(input: { name?: string; config?: Record<string, unknown> }): void {
    if (input.name !== undefined) {
      this.props.name = input.name;
    }
    if (input.config !== undefined) {
      this.props.config = input.config;
    }
    this.props.updatedAt = new Date();
  }

  markRun(): void {
    this.props.lastRunAt = new Date();
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<ReportProps> {
    return Object.freeze({ ...this.props });
  }
}

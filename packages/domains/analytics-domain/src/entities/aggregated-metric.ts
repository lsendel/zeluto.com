import { z } from 'zod';

export const MetricPeriodSchema = z.enum(['hourly', 'daily', 'monthly']);
export type MetricPeriod = z.infer<typeof MetricPeriodSchema>;

export const AggregatedMetricPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  metricType: z.string().min(1),
  period: MetricPeriodSchema,
  periodStart: z.coerce.date(),
  value: z.number(),
  dimensions: z.record(z.string(), z.unknown()),
});

export type AggregatedMetricProps = z.infer<typeof AggregatedMetricPropsSchema>;

export class AggregatedMetric {
  private constructor(private props: AggregatedMetricProps) {}

  static create(input: {
    organizationId: string;
    metricType: string;
    period: MetricPeriod;
    periodStart: Date;
    value: number;
    dimensions?: Record<string, unknown>;
  }): AggregatedMetric {
    return new AggregatedMetric(
      AggregatedMetricPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        metricType: input.metricType,
        period: input.period,
        periodStart: input.periodStart,
        value: input.value,
        dimensions: input.dimensions ?? {},
      }),
    );
  }

  static reconstitute(props: AggregatedMetricProps): AggregatedMetric {
    return new AggregatedMetric(AggregatedMetricPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get metricType(): string {
    return this.props.metricType;
  }
  get period(): MetricPeriod {
    return this.props.period;
  }
  get periodStart(): Date {
    return this.props.periodStart;
  }
  get value(): number {
    return this.props.value;
  }
  get dimensions(): Record<string, unknown> {
    return this.props.dimensions;
  }

  incrementValue(amount: number): void {
    this.props.value += amount;
  }

  toProps(): Readonly<AggregatedMetricProps> {
    return Object.freeze({ ...this.props });
  }
}

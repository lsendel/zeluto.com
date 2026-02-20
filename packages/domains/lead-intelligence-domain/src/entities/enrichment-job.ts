import { z } from 'zod';

export const EnrichmentResultSchema = z.object({
  field: z.string(),
  provider: z.string(),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  cost: z.number().min(0),
  latencyMs: z.number().int().min(0),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export const EnrichmentJobStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'exhausted',
]);
export type EnrichmentJobStatus = z.infer<typeof EnrichmentJobStatusSchema>;

export const EnrichmentJobPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  status: EnrichmentJobStatusSchema,
  fieldRequests: z.array(z.string()),
  results: z.array(EnrichmentResultSchema),
  totalCost: z.number().min(0),
  totalLatencyMs: z.number().int().min(0),
  providersTried: z.array(z.string()),
  error: z.string().nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type EnrichmentJobProps = z.infer<typeof EnrichmentJobPropsSchema>;

export class EnrichmentJob {
  private constructor(private props: EnrichmentJobProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    fieldRequests: string[];
  }): EnrichmentJob {
    return new EnrichmentJob({
      ...input,
      status: 'pending',
      results: [],
      totalCost: 0,
      totalLatencyMs: 0,
      providersTried: [],
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: EnrichmentJobProps): EnrichmentJob {
    return new EnrichmentJob(EnrichmentJobPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get status() {
    return this.props.status;
  }
  get fieldRequests() {
    return this.props.fieldRequests;
  }
  get results() {
    return this.props.results;
  }
  get totalCost() {
    return this.props.totalCost;
  }
  get totalLatencyMs() {
    return this.props.totalLatencyMs;
  }
  get providersTried() {
    return this.props.providersTried;
  }
  get error() {
    return this.props.error;
  }

  start(): void {
    this.props.status = 'running';
    this.props.startedAt = new Date();
  }

  addResult(result: EnrichmentResult): void {
    this.props.results.push(result);
    this.props.totalCost += result.cost;
    this.props.totalLatencyMs += result.latencyMs;
    if (!this.props.providersTried.includes(result.provider)) {
      this.props.providersTried.push(result.provider);
    }
  }

  complete(): void {
    this.props.status = 'completed';
    this.props.completedAt = new Date();
  }

  fail(error: string): void {
    this.props.status = 'failed';
    this.props.error = error;
    this.props.completedAt = new Date();
  }

  exhaust(): void {
    this.props.status = 'exhausted';
    this.props.completedAt = new Date();
  }

  toProps(): Readonly<EnrichmentJobProps> {
    return Object.freeze({ ...this.props });
  }
}

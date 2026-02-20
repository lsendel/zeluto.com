import { z } from 'zod';

export const WaterfallConfigPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  fieldName: z.string(),
  providerOrder: z.array(z.string()),
  maxAttempts: z.number().int().min(1).default(3),
  timeoutMs: z.number().int().min(100).default(5000),
  minConfidence: z.number().min(0).max(1).default(0.5),
  cacheTtlDays: z.number().int().min(0).default(7),
  maxCostPerLead: z.number().min(0).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type WaterfallConfigProps = z.infer<typeof WaterfallConfigPropsSchema>;

export class WaterfallConfig {
  private constructor(private props: WaterfallConfigProps) {}

  static create(input: {
    organizationId: string;
    fieldName: string;
    providerOrder: string[];
    maxAttempts?: number;
    timeoutMs?: number;
    minConfidence?: number;
    cacheTtlDays?: number;
    maxCostPerLead?: number | null;
  }): WaterfallConfig {
    return new WaterfallConfig(
      WaterfallConfigPropsSchema.parse({
        id: crypto.randomUUID(),
        ...input,
        maxCostPerLead: input.maxCostPerLead ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: WaterfallConfigProps): WaterfallConfig {
    return new WaterfallConfig(WaterfallConfigPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get fieldName() {
    return this.props.fieldName;
  }
  get providerOrder() {
    return this.props.providerOrder;
  }
  get maxAttempts() {
    return this.props.maxAttempts;
  }
  get timeoutMs() {
    return this.props.timeoutMs;
  }
  get minConfidence() {
    return this.props.minConfidence;
  }
  get cacheTtlDays() {
    return this.props.cacheTtlDays;
  }
  get maxCostPerLead() {
    return this.props.maxCostPerLead;
  }

  update(input: {
    providerOrder?: string[];
    maxAttempts?: number;
    timeoutMs?: number;
    minConfidence?: number;
    cacheTtlDays?: number;
    maxCostPerLead?: number | null;
  }): void {
    if (input.providerOrder !== undefined)
      this.props.providerOrder = input.providerOrder;
    if (input.maxAttempts !== undefined)
      this.props.maxAttempts = input.maxAttempts;
    if (input.timeoutMs !== undefined) this.props.timeoutMs = input.timeoutMs;
    if (input.minConfidence !== undefined)
      this.props.minConfidence = input.minConfidence;
    if (input.cacheTtlDays !== undefined)
      this.props.cacheTtlDays = input.cacheTtlDays;
    if (input.maxCostPerLead !== undefined)
      this.props.maxCostPerLead = input.maxCostPerLead;
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<WaterfallConfigProps> {
    return Object.freeze({ ...this.props });
  }
}

import { z } from 'zod';

export const EnrichmentProviderTypeSchema = z.enum([
  'clearbit', 'apollo', 'zoominfo', 'hunter', 'rocketreach', 'lusha', 'builtwith', 'wappalyzer',
]);

export type EnrichmentProviderType = z.infer<typeof EnrichmentProviderTypeSchema>;

export const EnrichmentProviderPropsSchema = z.object({
  id: z.string(),
  organizationId: z.string().uuid(),
  name: z.string(),
  providerType: EnrichmentProviderTypeSchema,
  supportedFields: z.array(z.string()),
  priority: z.number().int().min(0),
  costPerLookup: z.number().min(0),
  avgLatencyMs: z.number().int().min(0),
  successRate: z.number().min(0).max(1),
  batchSupported: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type EnrichmentProviderProps = z.infer<typeof EnrichmentProviderPropsSchema>;

export class EnrichmentProvider {
  private constructor(private props: EnrichmentProviderProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    name: string;
    providerType: EnrichmentProviderType;
    supportedFields: string[];
    priority: number;
    costPerLookup: number;
    batchSupported?: boolean;
    config?: Record<string, unknown>;
    enabled?: boolean;
  }): EnrichmentProvider {
    return new EnrichmentProvider(
      EnrichmentProviderPropsSchema.parse({
        ...input,
        avgLatencyMs: 0,
        successRate: 0,
        batchSupported: input.batchSupported ?? false,
        enabled: input.enabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: EnrichmentProviderProps): EnrichmentProvider {
    return new EnrichmentProvider(EnrichmentProviderPropsSchema.parse(props));
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get name() { return this.props.name; }
  get providerType() { return this.props.providerType; }
  get supportedFields() { return this.props.supportedFields; }
  get priority() { return this.props.priority; }
  get costPerLookup() { return this.props.costPerLookup; }
  get avgLatencyMs() { return this.props.avgLatencyMs; }
  get successRate() { return this.props.successRate; }
  get batchSupported() { return this.props.batchSupported; }
  get config() { return this.props.config; }
  get enabled() { return this.props.enabled; }

  supportsField(field: string): boolean {
    return this.props.supportedFields.includes(field);
  }

  disable(): void {
    this.props.enabled = false;
    this.props.updatedAt = new Date();
  }

  enable(): void {
    this.props.enabled = true;
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<EnrichmentProviderProps> {
    return Object.freeze({ ...this.props });
  }
}

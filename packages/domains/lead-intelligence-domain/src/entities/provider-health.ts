import { z } from 'zod';

export const CircuitStateSchema = z.enum(['closed', 'open', 'half_open']);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const ProviderHealthPropsSchema = z.object({
  organizationId: z.string().uuid(),
  providerId: z.string(),
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  lastFailureAt: z.coerce.date().nullable(),
  lastSuccessAt: z.coerce.date().nullable(),
  circuitState: CircuitStateSchema,
  circuitOpenedAt: z.coerce.date().nullable(),
});

export type ProviderHealthProps = z.infer<typeof ProviderHealthPropsSchema>;

const CIRCUIT_OPEN_DURATION_MS = 60_000; // 1 minute before half-open
const FAILURE_THRESHOLD = 5;

export class ProviderHealth {
  private constructor(private props: ProviderHealthProps) {}

  static create(organizationId: string, providerId: string): ProviderHealth {
    return new ProviderHealth({
      organizationId,
      providerId,
      successCount: 0,
      failureCount: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      circuitState: 'closed',
      circuitOpenedAt: null,
    });
  }

  static reconstitute(props: ProviderHealthProps): ProviderHealth {
    return new ProviderHealth(ProviderHealthPropsSchema.parse(props));
  }

  get organizationId() { return this.props.organizationId; }
  get providerId() { return this.props.providerId; }
  get circuitState() { return this.props.circuitState; }
  get successCount() { return this.props.successCount; }
  get failureCount() { return this.props.failureCount; }

  isAvailable(): boolean {
    if (this.props.circuitState === 'closed') return true;
    if (this.props.circuitState === 'half_open') return true;
    if (this.props.circuitState === 'open' && this.props.circuitOpenedAt) {
      const elapsed = Date.now() - this.props.circuitOpenedAt.getTime();
      if (elapsed >= CIRCUIT_OPEN_DURATION_MS) {
        this.props.circuitState = 'half_open';
        return true;
      }
    }
    return false;
  }

  recordSuccess(): void {
    this.props.successCount++;
    this.props.lastSuccessAt = new Date();
    if (this.props.circuitState === 'half_open') {
      this.props.circuitState = 'closed';
      this.props.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.props.failureCount++;
    this.props.lastFailureAt = new Date();
    if (this.props.failureCount >= FAILURE_THRESHOLD) {
      this.props.circuitState = 'open';
      this.props.circuitOpenedAt = new Date();
    }
  }

  toProps(): Readonly<ProviderHealthProps> {
    return Object.freeze({ ...this.props });
  }
}

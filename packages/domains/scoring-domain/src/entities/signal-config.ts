import { z } from 'zod';

export const SignalTierSchema = z.enum(['critical', 'high', 'medium', 'low']);
export type SignalTier = z.infer<typeof SignalTierSchema>;

export const SignalConfigPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  signalType: z.string(),
  weight: z.number().min(0),
  decayHours: z.number().int().min(0),
  tier: SignalTierSchema,
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SignalConfigProps = z.infer<typeof SignalConfigPropsSchema>;

export class SignalConfig {
  private constructor(private props: SignalConfigProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    signalType: string;
    weight: number;
    decayHours?: number;
    tier?: SignalTier;
    enabled?: boolean;
  }): SignalConfig {
    return new SignalConfig(
      SignalConfigPropsSchema.parse({
        ...input,
        decayHours: input.decayHours ?? 168,
        tier: input.tier ?? 'medium',
        enabled: input.enabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SignalConfigProps): SignalConfig {
    return new SignalConfig(SignalConfigPropsSchema.parse(props));
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get signalType() { return this.props.signalType; }
  get weight() { return this.props.weight; }
  get decayHours() { return this.props.decayHours; }
  get tier() { return this.props.tier; }
  get enabled() { return this.props.enabled; }

  update(input: {
    weight?: number;
    decayHours?: number;
    tier?: SignalTier;
    enabled?: boolean;
  }): void {
    if (input.weight !== undefined) this.props.weight = input.weight;
    if (input.decayHours !== undefined) this.props.decayHours = input.decayHours;
    if (input.tier !== undefined) this.props.tier = input.tier;
    if (input.enabled !== undefined) this.props.enabled = input.enabled;
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<SignalConfigProps> {
    return Object.freeze({ ...this.props });
  }
}

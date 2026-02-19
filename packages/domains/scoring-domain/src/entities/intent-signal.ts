import { z } from 'zod';

export const DecayModelSchema = z.enum(['linear', 'exponential', 'step']);
export type DecayModel = z.infer<typeof DecayModelSchema>;

export const IntentSignalPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  signalType: z.string(),
  source: z.string(),
  weight: z.number().min(0),
  detectedAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  decayModel: DecayModelSchema,
  decayHours: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});

export type IntentSignalProps = z.infer<typeof IntentSignalPropsSchema>;

export class IntentSignal {
  private constructor(private props: IntentSignalProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    signalType: string;
    source: string;
    weight: number;
    decayHours?: number;
    decayModel?: DecayModel;
    metadata?: Record<string, unknown>;
  }): IntentSignal {
    const decayHours = input.decayHours ?? 168; // 7 days default
    const now = new Date();
    return new IntentSignal(
      IntentSignalPropsSchema.parse({
        ...input,
        decayHours,
        decayModel: input.decayModel ?? 'linear',
        detectedAt: now,
        expiresAt: new Date(now.getTime() + decayHours * 60 * 60 * 1000),
        createdAt: now,
      }),
    );
  }

  static reconstitute(props: IntentSignalProps): IntentSignal {
    return new IntentSignal(IntentSignalPropsSchema.parse(props));
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get contactId() { return this.props.contactId; }
  get signalType() { return this.props.signalType; }
  get source() { return this.props.source; }
  get weight() { return this.props.weight; }
  get detectedAt() { return this.props.detectedAt; }
  get expiresAt() { return this.props.expiresAt; }
  get decayModel() { return this.props.decayModel; }
  get metadata() { return this.props.metadata; }

  currentWeight(): number {
    const elapsed = (Date.now() - this.props.detectedAt.getTime()) / (1000 * 60 * 60);
    const decayHours = this.props.decayHours;
    if (elapsed >= decayHours) return 0;

    switch (this.props.decayModel) {
      case 'linear':
        return this.props.weight * (1 - elapsed / decayHours);
      case 'exponential':
        return this.props.weight * Math.exp(-3 * elapsed / decayHours);
      case 'step':
        if (elapsed < decayHours * 0.5) return this.props.weight;
        if (elapsed < decayHours * 0.75) return this.props.weight * 0.5;
        return this.props.weight * 0.25;
    }
  }

  isExpired(): boolean {
    return this.currentWeight() === 0;
  }

  toProps(): Readonly<IntentSignalProps> {
    return Object.freeze({ ...this.props });
  }
}

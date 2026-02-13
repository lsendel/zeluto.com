import { z } from 'zod';

export const TriggerTypeSchema = z.enum([
  'event',
  'segment',
  'manual',
  'scheduled',
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export const JourneyTriggerPropsSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: TriggerTypeSchema,
  config: z.record(z.string(), z.unknown()),
});

export type JourneyTriggerProps = z.infer<typeof JourneyTriggerPropsSchema>;

export class JourneyTrigger {
  private constructor(private readonly props: JourneyTriggerProps) {}

  // ---- Factory methods ----

  static create(input: {
    journeyId: string;
    organizationId: string;
    type: TriggerType;
    config: Record<string, unknown>;
  }): JourneyTrigger {
    return new JourneyTrigger(
      JourneyTriggerPropsSchema.parse({
        id: crypto.randomUUID(),
        journeyId: input.journeyId,
        organizationId: input.organizationId,
        type: input.type,
        config: input.config,
      }),
    );
  }

  static reconstitute(props: JourneyTriggerProps): JourneyTrigger {
    return new JourneyTrigger(JourneyTriggerPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get journeyId(): string {
    return this.props.journeyId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get type(): TriggerType {
    return this.props.type;
  }
  get config(): Record<string, unknown> {
    return this.props.config;
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyTriggerProps> {
    return Object.freeze({ ...this.props });
  }
}

import { z } from 'zod';
import { Entity, Result } from '@mauntic/domain-kernel';

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

export class JourneyTrigger extends Entity<JourneyTriggerProps> {
  private constructor(props: JourneyTriggerProps) {
    super(props.id, props);
  }

  // ---- Factory methods ----

  static create(input: {
    journeyId: string;
    organizationId: string;
    type: TriggerType;
    config: Record<string, unknown>;
  }): Result<JourneyTrigger> {
    const id = crypto.randomUUID();
    const props = JourneyTriggerPropsSchema.parse({
      id,
      journeyId: input.journeyId,
      organizationId: input.organizationId,
      type: input.type,
      config: input.config,
    });
    return Result.ok(new JourneyTrigger(props));
  }

  static reconstitute(props: JourneyTriggerProps): Result<JourneyTrigger> {
    return Result.ok(new JourneyTrigger(JourneyTriggerPropsSchema.parse(props)));
  }

  // ---- Accessors ----

  get triggerId(): string {
    return this.id;
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

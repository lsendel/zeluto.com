import { Entity, Result } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const StepTypeSchema = z.enum([
  'trigger',
  'action',
  'condition',
  'delay',
  'split',
  'exit',
]);

export type StepType = z.infer<typeof StepTypeSchema>;

export const JourneyStepPropsSchema = z.object({
  id: z.string().uuid(),
  journeyVersionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: StepTypeSchema,
  config: z.record(z.string(), z.unknown()),
  positionX: z.number().int(),
  positionY: z.number().int(),
});

export type JourneyStepProps = z.infer<typeof JourneyStepPropsSchema>;

export class JourneyStep extends Entity<JourneyStepProps> {
  private constructor(props: JourneyStepProps) {
    super(props.id, props);
  }

  // ---- Factory methods ----

  static create(input: {
    journeyVersionId: string;
    organizationId: string;
    type: StepType;
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
  }): Result<JourneyStep> {
    const id = crypto.randomUUID();
    const props = JourneyStepPropsSchema.parse({
      id,
      journeyVersionId: input.journeyVersionId,
      organizationId: input.organizationId,
      type: input.type,
      config: input.config,
      positionX: input.positionX,
      positionY: input.positionY,
    });
    return Result.ok(new JourneyStep(props));
  }

  static reconstitute(props: JourneyStepProps): Result<JourneyStep> {
    return Result.ok(new JourneyStep(JourneyStepPropsSchema.parse(props)));
  }

  // ---- Accessors ----

  get stepId(): string {
    return this.id;
  }
  get journeyVersionId(): string {
    return this.props.journeyVersionId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get type(): StepType {
    return this.props.type;
  }
  get config(): Record<string, unknown> {
    return this.props.config;
  }
  get positionX(): number {
    return this.props.positionX;
  }
  get positionY(): number {
    return this.props.positionY;
  }

  // ---- Domain methods ----

  updatePosition(x: number, y: number): Result<void> {
    this.props.positionX = x;
    this.props.positionY = y;
    return Result.ok();
  }

  updateConfig(config: Record<string, unknown>): Result<void> {
    this.props.config = config;
    return Result.ok();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyStepProps> {
    return Object.freeze({ ...this.props });
  }
}

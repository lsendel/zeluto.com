import { z } from 'zod';

export const SequenceStepTypeSchema = z.enum([
  'email',
  'linkedin_connect',
  'linkedin_message',
  'sms',
  'phone_call',
  'wait',
]);
export type SequenceStepType = z.infer<typeof SequenceStepTypeSchema>;

export const SequenceStepSchema = z.object({
  type: SequenceStepTypeSchema,
  delayDays: z.number().int().min(0),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  abVariants: z
    .array(z.object({ subject: z.string(), body: z.string() }))
    .optional(),
});

export type SequenceStep = z.infer<typeof SequenceStepSchema>;

export const DailyLimitsSchema = z.object({
  email: z.number().int().min(0).default(100),
  linkedin: z.number().int().min(0).default(50),
  sms: z.number().int().min(0).default(25),
});

export const SendWindowSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  timezone: z.string(),
});

export const SequenceStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'archived',
]);
export type SequenceStatus = z.infer<typeof SequenceStatusSchema>;

export const SequencePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  steps: z.array(SequenceStepSchema),
  dailyLimits: DailyLimitsSchema.optional(),
  sendWindow: SendWindowSchema.optional(),
  status: SequenceStatusSchema,
  createdBy: z.string().uuid().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SequenceProps = z.infer<typeof SequencePropsSchema>;

export class Sequence {
  private constructor(private props: SequenceProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    name: string;
    steps?: SequenceStep[];
    dailyLimits?: { email: number; linkedin: number; sms: number };
    sendWindow?: { startHour: number; endHour: number; timezone: string };
    createdBy?: string;
  }): Sequence {
    return new Sequence(
      SequencePropsSchema.parse({
        ...input,
        steps: input.steps ?? [],
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SequenceProps): Sequence {
    return new Sequence(SequencePropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get name() {
    return this.props.name;
  }
  get steps() {
    return this.props.steps;
  }
  get dailyLimits() {
    return this.props.dailyLimits;
  }
  get sendWindow() {
    return this.props.sendWindow;
  }
  get status() {
    return this.props.status;
  }
  get stepCount() {
    return this.props.steps.length;
  }

  addStep(step: SequenceStep): void {
    if (this.props.steps.length >= 8)
      throw new Error('Maximum 8 steps per sequence');
    this.props.steps.push(SequenceStepSchema.parse(step));
    this.props.updatedAt = new Date();
  }

  activate(): void {
    if (this.props.steps.length === 0)
      throw new Error('Cannot activate empty sequence');
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  pause(): void {
    this.props.status = 'paused';
    this.props.updatedAt = new Date();
  }

  archive(): void {
    this.props.status = 'archived';
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<SequenceProps> {
    return Object.freeze({ ...this.props });
  }
}

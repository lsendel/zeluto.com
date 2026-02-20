import { z } from 'zod';

export const ActivityTypeSchema = z.enum([
  'call',
  'email',
  'meeting',
  'demo',
  'task',
  'note',
  'linkedin',
  'sms',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivityPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: ActivityTypeSchema,
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  outcome: z.string().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.coerce.date(),
});

export type ActivityProps = z.infer<typeof ActivityPropsSchema>;

export class Activity {
  private constructor(private props: ActivityProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    type: ActivityType;
    contactId?: string;
    dealId?: string;
    outcome?: string;
    durationMinutes?: number;
    notes?: string;
    scheduledAt?: Date;
    createdBy?: string;
  }): Activity {
    return new Activity(
      ActivityPropsSchema.parse({
        ...input,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ActivityProps): Activity {
    return new Activity(ActivityPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get type() {
    return this.props.type;
  }
  get contactId() {
    return this.props.contactId;
  }
  get dealId() {
    return this.props.dealId;
  }
  get outcome() {
    return this.props.outcome;
  }
  get durationMinutes() {
    return this.props.durationMinutes;
  }
  get notes() {
    return this.props.notes;
  }
  get scheduledAt() {
    return this.props.scheduledAt;
  }
  get completedAt() {
    return this.props.completedAt;
  }

  complete(outcome?: string): void {
    this.props.completedAt = new Date();
    if (outcome) this.props.outcome = outcome;
  }

  toProps(): Readonly<ActivityProps> {
    return Object.freeze({ ...this.props });
  }
}

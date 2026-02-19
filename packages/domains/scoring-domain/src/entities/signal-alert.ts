import { z } from 'zod';

export const AlertPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type AlertPriority = z.infer<typeof AlertPrioritySchema>;

export const AlertStatusSchema = z.enum(['open', 'acknowledged', 'expired']);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const SignalAlertPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  signalType: z.string(),
  priority: AlertPrioritySchema,
  deadline: z.coerce.date(),
  acknowledgedAt: z.coerce.date().optional(),
  acknowledgedBy: z.string().uuid().optional(),
  status: AlertStatusSchema,
  createdAt: z.coerce.date(),
});

export type SignalAlertProps = z.infer<typeof SignalAlertPropsSchema>;

// SLA deadlines by priority
const SLA_HOURS: Record<AlertPriority, number> = {
  critical: 1,
  high: 4,
  medium: 24,
  low: 72,
};

export class SignalAlert {
  private constructor(private props: SignalAlertProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    signalType: string;
    priority: AlertPriority;
  }): SignalAlert {
    const now = new Date();
    const slaHours = SLA_HOURS[input.priority];
    return new SignalAlert(
      SignalAlertPropsSchema.parse({
        ...input,
        deadline: new Date(now.getTime() + slaHours * 60 * 60 * 1000),
        status: 'open',
        createdAt: now,
      }),
    );
  }

  static reconstitute(props: SignalAlertProps): SignalAlert {
    return new SignalAlert(SignalAlertPropsSchema.parse(props));
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get contactId() { return this.props.contactId; }
  get signalType() { return this.props.signalType; }
  get priority() { return this.props.priority; }
  get deadline() { return this.props.deadline; }
  get acknowledgedAt() { return this.props.acknowledgedAt; }
  get acknowledgedBy() { return this.props.acknowledgedBy; }
  get status() { return this.props.status; }

  acknowledge(userId: string): void {
    if (this.props.status !== 'open') return;
    this.props.status = 'acknowledged';
    this.props.acknowledgedAt = new Date();
    this.props.acknowledgedBy = userId;
  }

  markExpired(): void {
    if (this.props.status !== 'open') return;
    this.props.status = 'expired';
  }

  isOverdue(): boolean {
    return this.props.status === 'open' && new Date() > this.props.deadline;
  }

  toProps(): Readonly<SignalAlertProps> {
    return Object.freeze({ ...this.props });
  }
}

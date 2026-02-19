import { z } from 'zod';

export const DealStageSchema = z.enum([
  'prospecting', 'qualification', 'needs_analysis', 'proposal',
  'negotiation', 'contract_sent', 'closed_won', 'closed_lost',
]);
export type DealStage = z.infer<typeof DealStageSchema>;

const STAGE_PROBABILITY: Record<DealStage, number> = {
  prospecting: 10,
  qualification: 20,
  needs_analysis: 40,
  proposal: 60,
  negotiation: 75,
  contract_sent: 90,
  closed_won: 100,
  closed_lost: 0,
};

const STAGE_ORDER: DealStage[] = [
  'prospecting', 'qualification', 'needs_analysis', 'proposal',
  'negotiation', 'contract_sent', 'closed_won', 'closed_lost',
];

export const DealPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  contactId: z.string().uuid(),
  name: z.string(),
  stage: DealStageSchema,
  value: z.number().min(0),
  probability: z.number().int().min(0).max(100),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assignedRep: z.string().uuid().optional(),
  expectedCloseAt: z.coerce.date().optional(),
  closedAt: z.coerce.date().optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DealProps = z.infer<typeof DealPropsSchema>;

export class Deal {
  private constructor(private props: DealProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    name: string;
    value?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    accountId?: string;
    assignedRep?: string;
    expectedCloseAt?: Date;
  }): Deal {
    const stage: DealStage = 'prospecting';
    return new Deal(
      DealPropsSchema.parse({
        ...input,
        stage,
        value: input.value ?? 0,
        probability: STAGE_PROBABILITY[stage],
        priority: input.priority ?? 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: DealProps): Deal {
    return new Deal(DealPropsSchema.parse(props));
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get accountId() { return this.props.accountId; }
  get contactId() { return this.props.contactId; }
  get name() { return this.props.name; }
  get stage() { return this.props.stage; }
  get value() { return this.props.value; }
  get probability() { return this.props.probability; }
  get priority() { return this.props.priority; }
  get assignedRep() { return this.props.assignedRep; }
  get expectedCloseAt() { return this.props.expectedCloseAt; }
  get closedAt() { return this.props.closedAt; }
  get lostReason() { return this.props.lostReason; }
  get notes() { return this.props.notes; }

  moveToStage(newStage: DealStage): { fromStage: DealStage; toStage: DealStage } {
    const fromStage = this.props.stage;
    if (fromStage === 'closed_won' || fromStage === 'closed_lost') {
      throw new Error('Cannot change stage of a closed deal');
    }

    this.props.stage = newStage;
    this.props.probability = STAGE_PROBABILITY[newStage];
    this.props.updatedAt = new Date();

    if (newStage === 'closed_won') {
      this.props.closedAt = new Date();
    } else if (newStage === 'closed_lost') {
      this.props.closedAt = new Date();
    }

    return { fromStage, toStage: newStage };
  }

  markLost(reason: string): void {
    this.moveToStage('closed_lost');
    this.props.lostReason = reason;
  }

  assignTo(repId: string): void {
    this.props.assignedRep = repId;
    this.props.updatedAt = new Date();
  }

  updateValue(value: number): void {
    this.props.value = value;
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<DealProps> {
    return Object.freeze({ ...this.props });
  }
}

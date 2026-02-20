import { z } from 'zod';

export const ScoreHistoryPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  totalScore: z.number().int(),
  engagementScore: z.number().int(),
  fitScore: z.number().int(),
  intentScore: z.number().int(),
  createdAt: z.coerce.date(),
});

export type ScoreHistoryProps = z.infer<typeof ScoreHistoryPropsSchema>;

export class ScoreHistory {
  private constructor(private props: ScoreHistoryProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    date: string;
    totalScore: number;
    engagementScore?: number;
    fitScore?: number;
    intentScore?: number;
  }): ScoreHistory {
    return new ScoreHistory(
      ScoreHistoryPropsSchema.parse({
        ...input,
        engagementScore: input.engagementScore ?? 0,
        fitScore: input.fitScore ?? 0,
        intentScore: input.intentScore ?? 0,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ScoreHistoryProps): ScoreHistory {
    return new ScoreHistory(ScoreHistoryPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get date() {
    return this.props.date;
  }
  get totalScore() {
    return this.props.totalScore;
  }
  get engagementScore() {
    return this.props.engagementScore;
  }
  get fitScore() {
    return this.props.fitScore;
  }
  get intentScore() {
    return this.props.intentScore;
  }

  toProps(): Readonly<ScoreHistoryProps> {
    return Object.freeze({ ...this.props });
  }
}

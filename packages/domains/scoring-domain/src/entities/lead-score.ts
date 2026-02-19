import { z } from 'zod';

export const GradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);
export type Grade = z.infer<typeof GradeSchema>;

export const LeadScorePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  totalScore: z.number().int().min(0).max(100),
  grade: GradeSchema,
  engagementScore: z.number().int().min(0),
  fitScore: z.number().int().min(0),
  intentScore: z.number().int().min(0),
  components: z.record(z.number()).optional(),
  topContributors: z.array(z.object({ factor: z.string(), points: z.number() })).optional(),
  scoredAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type LeadScoreProps = z.infer<typeof LeadScorePropsSchema>;

export function calculateGrade(score: number): Grade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

export class LeadScore {
  private constructor(private props: LeadScoreProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    totalScore?: number;
    engagementScore?: number;
    fitScore?: number;
    intentScore?: number;
    components?: Record<string, number>;
    topContributors?: Array<{ factor: string; points: number }>;
  }): LeadScore {
    const totalScore = input.totalScore ?? 0;
    return new LeadScore(
      LeadScorePropsSchema.parse({
        ...input,
        totalScore,
        grade: calculateGrade(totalScore),
        engagementScore: input.engagementScore ?? 0,
        fitScore: input.fitScore ?? 0,
        intentScore: input.intentScore ?? 0,
        scoredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: LeadScoreProps): LeadScore {
    return new LeadScore(LeadScorePropsSchema.parse(props));
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get contactId() { return this.props.contactId; }
  get totalScore() { return this.props.totalScore; }
  get grade() { return this.props.grade; }
  get engagementScore() { return this.props.engagementScore; }
  get fitScore() { return this.props.fitScore; }
  get intentScore() { return this.props.intentScore; }
  get components() { return this.props.components; }
  get topContributors() { return this.props.topContributors; }
  get scoredAt() { return this.props.scoredAt; }

  updateScore(input: {
    totalScore: number;
    engagementScore: number;
    fitScore: number;
    intentScore: number;
    components?: Record<string, number>;
    topContributors?: Array<{ factor: string; points: number }>;
  }): void {
    this.props.totalScore = Math.min(100, Math.max(0, input.totalScore));
    this.props.grade = calculateGrade(this.props.totalScore);
    this.props.engagementScore = input.engagementScore;
    this.props.fitScore = input.fitScore;
    this.props.intentScore = input.intentScore;
    this.props.components = input.components;
    this.props.topContributors = input.topContributors;
    this.props.scoredAt = new Date();
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<LeadScoreProps> {
    return Object.freeze({ ...this.props });
  }
}

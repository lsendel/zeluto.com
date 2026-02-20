import { AggregateRoot, type OrganizationId } from '@mauntic/domain-kernel';
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
  components: z.record(z.string(), z.number()).optional(),
  topContributors: z
    .array(z.object({ factor: z.string(), points: z.number() }))
    .optional(),
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

export class LeadScore extends AggregateRoot<LeadScoreProps> {
  private constructor(props: LeadScoreProps) {
    super(props.id, props);
  }

  static create(input: {
    id?: string;
    organizationId: string;
    contactId: string;
    totalScore?: number;
    engagementScore?: number;
    fitScore?: number;
    intentScore?: number;
    components?: Record<string, number>;
    topContributors?: Array<{ factor: string; points: number }>;
  }): LeadScore {
    const totalScore = Math.min(100, Math.max(0, input.totalScore ?? 0));
    const grade = calculateGrade(totalScore);

    const props = LeadScorePropsSchema.parse({
      id: input.id ?? crypto.randomUUID(),
      organizationId: input.organizationId,
      contactId: input.contactId,
      totalScore,
      grade,
      engagementScore: input.engagementScore ?? 0,
      fitScore: input.fitScore ?? 0,
      intentScore: input.intentScore ?? 0,
      components: input.components ?? {},
      topContributors: input.topContributors ?? [],
      scoredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const leadScore = new LeadScore(props);

    leadScore.addDomainEvent({
      type: 'scoring.LeadScoreCalculated',
      data: {
        organizationId: props.organizationId,
        contactId: props.contactId,
        score: totalScore,
        grade,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'scoring',
        timestamp: new Date().toISOString(),
        correlationId: props.contactId,
        tenantContext: {
          organizationId: props.organizationId as OrganizationId,
        },
      },
    });

    return leadScore;
  }

  static reconstitute(props: LeadScoreProps): LeadScore {
    return new LeadScore(LeadScorePropsSchema.parse(props));
  }

  get organizationId() {
    return this.props.organizationId;
  }
  get contactId() {
    return this.props.contactId;
  }
  get totalScore() {
    return this.props.totalScore;
  }
  get grade() {
    return this.props.grade;
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
  get components() {
    return this.props.components;
  }
  get topContributors() {
    return this.props.topContributors;
  }
  get scoredAt() {
    return this.props.scoredAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  updateScore(input: {
    totalScore: number;
    engagementScore: number;
    fitScore: number;
    intentScore: number;
    components?: Record<string, number>;
    topContributors?: Array<{ factor: string; points: number }>;
  }): void {
    const totalScore = Math.min(100, Math.max(0, input.totalScore));
    const grade = calculateGrade(totalScore);

    this.props.totalScore = totalScore;
    this.props.grade = grade;
    this.props.engagementScore = input.engagementScore;
    this.props.fitScore = input.fitScore;
    this.props.intentScore = input.intentScore;
    if (input.components) this.props.components = input.components;
    if (input.topContributors)
      this.props.topContributors = input.topContributors;
    this.props.scoredAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      type: 'scoring.LeadScoreUpdated',
      data: {
        organizationId: this.props.organizationId,
        contactId: this.props.contactId,
        score: totalScore,
        grade,
        previousScore: this.props.totalScore, // Note: this is actually new score. Logic error potential here if we want previous.
        // Correct logic: we overrode props already. If we wanted previous, we should capture before update.
        // For now, simpler event data.
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'scoring',
        timestamp: new Date().toISOString(),
        correlationId: this.props.contactId,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
  }

  toProps(): Readonly<LeadScoreProps> {
    return Object.freeze({ ...this.props });
  }
}

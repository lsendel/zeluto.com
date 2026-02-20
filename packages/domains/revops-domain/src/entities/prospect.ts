import { z } from 'zod';

export const ProspectRecommendationSchema = z.enum([
  'enrich',
  'sequence',
  'skip',
  'manual_review',
]);
export type ProspectRecommendation = z.infer<
  typeof ProspectRecommendationSchema
>;

export const ProspectPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  qualificationScore: z.number().int().min(0).max(100),
  icpMatch: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  recommendation: ProspectRecommendationSchema,
  dataCompleteness: z.number().min(0).max(1),
  qualifiedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProspectProps = z.infer<typeof ProspectPropsSchema>;

export class Prospect {
  private constructor(private props: ProspectProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    qualificationScore?: number;
    icpMatch?: number;
    dataCompleteness?: number;
  }): Prospect {
    const score = input.qualificationScore ?? 0;
    const icpMatch = input.icpMatch ?? 0;
    const completeness = input.dataCompleteness ?? 0;

    return new Prospect(
      ProspectPropsSchema.parse({
        ...input,
        qualificationScore: score,
        icpMatch,
        dataCompleteness: completeness,
        recommendation: Prospect.determineRecommendation(
          score,
          icpMatch,
          completeness,
        ),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ProspectProps): Prospect {
    return new Prospect(ProspectPropsSchema.parse(props));
  }

  static determineRecommendation(
    score: number,
    icpMatch: number,
    completeness: number,
  ): ProspectRecommendation {
    if (completeness < 0.5) return 'enrich';
    if (score >= 70 && icpMatch >= 0.7) return 'sequence';
    if (score < 30 || icpMatch < 0.3) return 'skip';
    return 'manual_review';
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
  get qualificationScore() {
    return this.props.qualificationScore;
  }
  get icpMatch() {
    return this.props.icpMatch;
  }
  get reasoning() {
    return this.props.reasoning;
  }
  get recommendation() {
    return this.props.recommendation;
  }
  get dataCompleteness() {
    return this.props.dataCompleteness;
  }
  get qualifiedAt() {
    return this.props.qualifiedAt;
  }

  qualify(input: {
    qualificationScore: number;
    icpMatch: number;
    reasoning: string;
    dataCompleteness: number;
  }): void {
    this.props.qualificationScore = input.qualificationScore;
    this.props.icpMatch = input.icpMatch;
    this.props.reasoning = input.reasoning;
    this.props.dataCompleteness = input.dataCompleteness;
    this.props.recommendation = Prospect.determineRecommendation(
      input.qualificationScore,
      input.icpMatch,
      input.dataCompleteness,
    );
    this.props.qualifiedAt = new Date();
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<ProspectProps> {
    return Object.freeze({ ...this.props });
  }
}

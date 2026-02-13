import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const AbTestStatusSchema = z.enum(['running', 'completed', 'canceled']);
export type AbTestStatus = z.infer<typeof AbTestStatusSchema>;

export const WinnerCriteriaSchema = z.enum(['opens', 'clicks', 'conversions']);
export type WinnerCriteria = z.infer<typeof WinnerCriteriaSchema>;

export const AbTestVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string().optional(),
  templateId: z.string().uuid().optional(),
  percentage: z.number().min(0).max(100),
});

export type AbTestVariant = z.infer<typeof AbTestVariantSchema>;

export const AbTestPropsSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  variants: z.array(AbTestVariantSchema),
  winnerCriteria: WinnerCriteriaSchema,
  testPercentage: z.number().min(1).max(100),
  winnerVariantId: z.string().nullable(),
  status: AbTestStatusSchema,
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AbTestProps = z.infer<typeof AbTestPropsSchema>;

export class AbTest {
  private constructor(private props: AbTestProps) {}

  // ---- Factory methods ----

  static create(input: {
    campaignId: string;
    organizationId: string;
    name: string;
    variants: AbTestVariant[];
    winnerCriteria: WinnerCriteria;
    testPercentage?: number;
  }): AbTest {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('A/B test name is required');
    }
    if (input.variants.length < 2) {
      throw new InvariantViolation('A/B test must have at least 2 variants');
    }

    return new AbTest(
      AbTestPropsSchema.parse({
        id: crypto.randomUUID(),
        campaignId: input.campaignId,
        organizationId: input.organizationId,
        name: input.name.trim(),
        variants: input.variants,
        winnerCriteria: input.winnerCriteria,
        testPercentage: input.testPercentage ?? 20,
        winnerVariantId: null,
        status: 'running',
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: AbTestProps): AbTest {
    return new AbTest(AbTestPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get variants(): readonly AbTestVariant[] {
    return this.props.variants;
  }
  get winnerCriteria(): WinnerCriteria {
    return this.props.winnerCriteria;
  }
  get testPercentage(): number {
    return this.props.testPercentage;
  }
  get winnerVariantId(): string | null {
    return this.props.winnerVariantId;
  }
  get status(): AbTestStatus {
    return this.props.status;
  }
  get startedAt(): Date | null {
    return this.props.startedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  selectWinner(variantId: string): void {
    if (this.props.status !== 'running') {
      throw new InvariantViolation(
        `Cannot select winner when A/B test status is "${this.props.status}"`,
      );
    }
    const variant = this.props.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new InvariantViolation(`Variant "${variantId}" not found in this A/B test`);
    }
    this.props.winnerVariantId = variantId;
    this.props.status = 'completed';
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (this.props.status !== 'running') {
      throw new InvariantViolation(
        `Cannot cancel A/B test from status "${this.props.status}"`,
      );
    }
    this.props.status = 'canceled';
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<AbTestProps> {
    return Object.freeze({ ...this.props });
  }
}

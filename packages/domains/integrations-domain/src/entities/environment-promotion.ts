import { z } from 'zod';

export const DeploymentEnvironmentSchema = z.enum(['dev', 'stage', 'prod']);
export type DeploymentEnvironment = z.infer<typeof DeploymentEnvironmentSchema>;

export const PromotionStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'applied',
]);
export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;

export const PromotionScopeSchema = z
  .object({
    connectionIds: z.array(z.string().uuid()).default([]),
    oauthAppIds: z.array(z.string().uuid()).default([]),
    webhookIds: z.array(z.string().uuid()).default([]),
  })
  .refine(
    (scope) =>
      scope.connectionIds.length > 0 ||
      scope.oauthAppIds.length > 0 ||
      scope.webhookIds.length > 0,
    {
      message: 'Promotion scope must include at least one resource identifier',
    },
  );
export type PromotionScope = z.infer<typeof PromotionScopeSchema>;

export const EnvironmentPromotionPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  sourceEnvironment: DeploymentEnvironmentSchema,
  targetEnvironment: DeploymentEnvironmentSchema,
  scope: PromotionScopeSchema,
  notes: z.string().max(500).nullable(),
  status: PromotionStatusSchema,
  requestedBy: z.string().uuid(),
  requestedAt: z.coerce.date(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.coerce.date().nullable(),
  rejectionReason: z.string().max(500).nullable(),
  appliedAt: z.coerce.date().nullable(),
});
export type EnvironmentPromotionProps = z.infer<
  typeof EnvironmentPromotionPropsSchema
>;

export class InvalidPromotionPathError extends Error {
  override name = 'InvalidPromotionPathError';
}

export class InvalidPromotionStatusTransitionError extends Error {
  override name = 'InvalidPromotionStatusTransitionError';
}

export class EnvironmentPromotion {
  private constructor(private props: EnvironmentPromotionProps) {}

  static create(input: {
    organizationId: string;
    sourceEnvironment: DeploymentEnvironment;
    targetEnvironment: DeploymentEnvironment;
    scope: PromotionScope;
    notes?: string | null;
    requestedBy: string;
    requestedAt?: Date;
  }): EnvironmentPromotion {
    if (
      !isPromotionPathAllowed(input.sourceEnvironment, input.targetEnvironment)
    ) {
      throw new InvalidPromotionPathError(
        `${input.sourceEnvironment} -> ${input.targetEnvironment} is not allowed`,
      );
    }

    return new EnvironmentPromotion(
      EnvironmentPromotionPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        sourceEnvironment: input.sourceEnvironment,
        targetEnvironment: input.targetEnvironment,
        scope: input.scope,
        notes: normalizeNotes(input.notes),
        status: 'pending',
        requestedBy: input.requestedBy,
        requestedAt: input.requestedAt ?? new Date(),
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        appliedAt: null,
      }),
    );
  }

  static reconstitute(props: EnvironmentPromotionProps): EnvironmentPromotion {
    return new EnvironmentPromotion(
      EnvironmentPromotionPropsSchema.parse(props),
    );
  }

  approve(input: { reviewedBy: string; reviewedAt?: Date }) {
    if (this.props.status !== 'pending') {
      throw new InvalidPromotionStatusTransitionError(
        'Only pending promotions can be approved',
      );
    }

    this.props.status = 'approved';
    this.props.reviewedBy = input.reviewedBy;
    this.props.reviewedAt = input.reviewedAt ?? new Date();
    this.props.rejectionReason = null;
  }

  reject(input: { reviewedBy: string; reason: string; reviewedAt?: Date }) {
    if (this.props.status !== 'pending') {
      throw new InvalidPromotionStatusTransitionError(
        'Only pending promotions can be rejected',
      );
    }

    this.props.status = 'rejected';
    this.props.reviewedBy = input.reviewedBy;
    this.props.reviewedAt = input.reviewedAt ?? new Date();
    this.props.rejectionReason = normalizeRejectionReason(input.reason);
  }

  apply(input?: { appliedAt?: Date }) {
    if (this.props.status !== 'approved') {
      throw new InvalidPromotionStatusTransitionError(
        'Only approved promotions can be applied',
      );
    }

    this.props.status = 'applied';
    this.props.appliedAt = input?.appliedAt ?? new Date();
  }

  toProps(): Readonly<EnvironmentPromotionProps> {
    return Object.freeze({ ...this.props });
  }
}

export function isPromotionPathAllowed(
  source: DeploymentEnvironment,
  target: DeploymentEnvironment,
): boolean {
  if (source === target) return false;
  if (source === 'dev' && target === 'stage') return true;
  if (source === 'stage' && target === 'prod') return true;
  return false;
}

function normalizeNotes(notes?: string | null): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

function normalizeRejectionReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new InvalidPromotionStatusTransitionError(
      'Rejection reason is required',
    );
  }
  return trimmed.slice(0, 500);
}

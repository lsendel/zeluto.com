import { ConflictError, InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SubscriptionStatusSchema = z.enum([
  'active',
  'past_due',
  'canceled',
  'trialing',
]);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  status: SubscriptionStatusSchema,
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  currentPeriodStart: z.date().nullable(),
  currentPeriodEnd: z.date().nullable(),
  trialEnd: z.date().nullable(),
  canceledAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const CreateSubscriptionSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  status: SubscriptionStatusSchema.default('trialing'),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  currentPeriodStart: z.date().optional(),
  currentPeriodEnd: z.date().optional(),
  trialEnd: z.date().optional(),
});

export type CreateSubscription = z.infer<typeof CreateSubscriptionSchema>;

export const UpdateSubscriptionSchema = z.object({
  planId: z.string().uuid().optional(),
  status: SubscriptionStatusSchema.optional(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  currentPeriodStart: z.date().optional(),
  currentPeriodEnd: z.date().optional(),
  trialEnd: z.date().optional(),
  canceledAt: z.date().optional(),
});

export type UpdateSubscription = z.infer<typeof UpdateSubscriptionSchema>;

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ['active', 'canceled'],
  active: ['canceled', 'past_due'],
  past_due: ['active', 'canceled'],
  canceled: [], // terminal state
};

// ---------------------------------------------------------------------------
// Subscription aggregate
// ---------------------------------------------------------------------------

export class SubscriptionAggregate {
  private constructor(private readonly data: Subscription) {}

  /** Reconstitute from a DB row. */
  static from(row: Subscription): SubscriptionAggregate {
    return new SubscriptionAggregate(row);
  }

  /** Validate that no other active subscription exists for the org before creating a new one. */
  static validateNoDuplicate(
    existing: { status: string; organizationId: string } | null | undefined,
  ): void {
    if (existing && existing.status !== 'canceled') {
      throw new ConflictError(
        `Organization ${existing.organizationId} already has an active subscription`,
      );
    }
  }

  get snapshot(): Readonly<Subscription> {
    return this.data;
  }

  get id(): string {
    return this.data.id;
  }

  get organizationId(): string {
    return this.data.organizationId;
  }

  get planId(): string {
    return this.data.planId;
  }

  get status(): SubscriptionStatus {
    return this.data.status;
  }

  /** Whether the subscription is currently in a trial period. */
  get isTrialing(): boolean {
    if (this.data.status !== 'trialing') return false;
    if (!this.data.trialEnd) return false;
    return this.data.trialEnd > new Date();
  }

  // -----------------------------------------------------------------------
  // Status transitions
  // -----------------------------------------------------------------------

  /** Validate and apply a status transition. */
  transitionTo(newStatus: SubscriptionStatus): UpdateSubscription {
    const allowed = VALID_TRANSITIONS[this.data.status];
    if (!allowed.includes(newStatus)) {
      throw new InvariantViolation(
        `Cannot transition subscription from "${this.data.status}" to "${newStatus}"`,
      );
    }
    const update: UpdateSubscription = { status: newStatus };
    if (newStatus === 'canceled') {
      update.canceledAt = new Date();
    }
    return update;
  }

  /** Cancel at period end. */
  cancel(): UpdateSubscription {
    return this.transitionTo('canceled');
  }

  /** Mark as past_due (e.g. failed payment). */
  markPastDue(): UpdateSubscription {
    return this.transitionTo('past_due');
  }

  /** Reactivate after successful payment. */
  reactivate(): UpdateSubscription {
    return this.transitionTo('active');
  }

  /** Activate after trial conversion. */
  activate(): UpdateSubscription {
    return this.transitionTo('active');
  }

  // -----------------------------------------------------------------------
  // Plan changes
  // -----------------------------------------------------------------------

  /**
   * Validate a plan change.
   * - Cannot downgrade during trial
   * - currentPlanPrice and newPlanPrice are in cents
   */
  validatePlanChange(
    newPlanPriceMonthly: number,
    currentPlanPriceMonthly: number,
  ): void {
    if (this.data.status === 'canceled') {
      throw new InvariantViolation(
        'Cannot change plan on a canceled subscription',
      );
    }

    const isDowngrade = newPlanPriceMonthly < currentPlanPriceMonthly;
    if (isDowngrade && this.isTrialing) {
      throw new InvariantViolation('Cannot downgrade during trial period');
    }
  }

  /** Build the update payload for a plan change. */
  changePlan(newPlanId: string): UpdateSubscription {
    if (this.data.status === 'canceled') {
      throw new InvariantViolation(
        'Cannot change plan on a canceled subscription',
      );
    }
    return { planId: newPlanId };
  }
}

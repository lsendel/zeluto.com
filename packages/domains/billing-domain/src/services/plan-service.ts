import { NotFoundError } from '@mauntic/domain-kernel';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { planLimits, plans } from '../../drizzle/schema.js';
import type { Plan, PlanLimit } from '../entities/plan.js';

export interface PlanWithLimits {
  plan: Plan;
  limits: PlanLimit[];
}

export interface PlanComparison {
  currentPlan: Plan;
  newPlan: Plan;
  isUpgrade: boolean;
  isDowngrade: boolean;
  priceDifferenceMonthly: number; // positive = more expensive (upgrade)
  priceDifferenceYearly: number;
}

export class PlanService {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  /** Get a single plan by ID, throws if not found. */
  async getPlan(planId: string): Promise<Plan> {
    const [plan] = await this.db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundError('Plan', planId);
    }

    return plan as unknown as Plan;
  }

  /** Get all active plans. */
  async listActivePlans(): Promise<Plan[]> {
    const rows = await this.db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true));

    return rows as unknown as Plan[];
  }

  /** Get the limits for a specific plan. */
  async getPlanLimits(planId: string): Promise<PlanLimit[]> {
    const rows = await this.db
      .select()
      .from(planLimits)
      .where(eq(planLimits.planId, planId));

    return rows as unknown as PlanLimit[];
  }

  /** Get the limit for a specific resource on a plan. */
  async getResourceLimit(
    planId: string,
    resource: string,
  ): Promise<PlanLimit | null> {
    const [row] = await this.db
      .select()
      .from(planLimits)
      .where(
        and(eq(planLimits.planId, planId), eq(planLimits.resource, resource)),
      )
      .limit(1);

    return (row as unknown as PlanLimit) ?? null;
  }

  /** Get a plan together with its limits. */
  async getPlanWithLimits(planId: string): Promise<PlanWithLimits> {
    const plan = await this.getPlan(planId);
    const limits = await this.getPlanLimits(planId);
    return { plan, limits };
  }

  /**
   * Compare two plans. Returns whether the move is an upgrade or downgrade
   * and the price difference.
   */
  async comparePlans(
    currentPlanId: string,
    newPlanId: string,
  ): Promise<PlanComparison> {
    const currentPlan = await this.getPlan(currentPlanId);
    const newPlan = await this.getPlan(newPlanId);

    const priceDifferenceMonthly =
      newPlan.priceMonthly - currentPlan.priceMonthly;
    const priceDifferenceYearly = newPlan.priceYearly - currentPlan.priceYearly;

    return {
      currentPlan,
      newPlan,
      isUpgrade: priceDifferenceMonthly > 0,
      isDowngrade: priceDifferenceMonthly < 0,
      priceDifferenceMonthly,
      priceDifferenceYearly,
    };
  }
}

import { and, desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  planLimits,
  subscriptions,
  usageRecords,
} from '../../drizzle/schema.js';
import { getBillingPeriod } from '../entities/usage-record.js';

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
}

export class QuotaChecker {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  async checkQuota(
    organizationId: string,
    resource: string,
  ): Promise<QuotaCheckResult> {
    // Get active subscription
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      return {
        allowed: false,
        current: 0,
        limit: 0,
        resource,
      };
    }

    // Get plan limit for this resource
    const [planLimit] = await this.db
      .select()
      .from(planLimits)
      .where(
        and(
          eq(planLimits.planId, subscription.planId),
          eq(planLimits.resource, resource),
        ),
      )
      .limit(1);

    if (!planLimit) {
      // No limit defined = not allowed
      return {
        allowed: false,
        current: 0,
        limit: 0,
        resource,
      };
    }

    // Get current usage
    const { periodStart, periodEnd } = getBillingPeriod();

    const [usage] = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          eq(usageRecords.resource, resource),
          eq(usageRecords.periodStart, periodStart),
          eq(usageRecords.periodEnd, periodEnd),
        ),
      )
      .limit(1);

    const currentValue = usage?.currentValue ?? 0;

    // -1 = unlimited
    if (planLimit.limitValue === -1) {
      return {
        allowed: true,
        current: currentValue,
        limit: -1,
        resource,
      };
    }

    return {
      allowed: currentValue < planLimit.limitValue,
      current: currentValue,
      limit: planLimit.limitValue,
      resource,
    };
  }

  async incrementUsage(
    organizationId: string,
    resource: string,
    amount: number = 1,
  ): Promise<void> {
    const { periodStart, periodEnd } = getBillingPeriod();

    // Upsert usage record
    const [existing] = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          eq(usageRecords.resource, resource),
          eq(usageRecords.periodStart, periodStart),
          eq(usageRecords.periodEnd, periodEnd),
        ),
      )
      .limit(1);

    const now = new Date();

    if (existing) {
      await this.db
        .update(usageRecords)
        .set({
          currentValue: existing.currentValue + amount,
          updatedAt: now,
        })
        .where(eq(usageRecords.id, existing.id));
    } else {
      await this.db.insert(usageRecords).values({
        organizationId,
        resource,
        periodStart,
        periodEnd,
        currentValue: amount,
      });
    }
  }

  /**
   * Get all current usage for an organization across all resources.
   */
  async getAllUsage(organizationId: string): Promise<QuotaCheckResult[]> {
    // Get active subscription
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      return [];
    }

    // Get all plan limits
    const limits = await this.db
      .select()
      .from(planLimits)
      .where(eq(planLimits.planId, subscription.planId));

    // Get all current usage records
    const { periodStart, periodEnd } = getBillingPeriod();
    const usages = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          eq(usageRecords.periodStart, periodStart),
          eq(usageRecords.periodEnd, periodEnd),
        ),
      );

    // Build a map of resource → current value
    const usageMap = new Map<string, number>();
    for (const u of usages) {
      usageMap.set(u.resource, u.currentValue);
    }

    return limits.map((limit) => {
      const currentValue = usageMap.get(limit.resource) ?? 0;
      return {
        allowed: limit.limitValue === -1 || currentValue < limit.limitValue,
        current: currentValue,
        limit: limit.limitValue,
        resource: limit.resource,
      };
    });
  }
}

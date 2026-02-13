import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { subscriptions, planLimits, usageRecords } from '../../drizzle/schema.js';

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
}

export class QuotaChecker {
  constructor(private db: NodePgDatabase<any>) {}

  async checkQuota(
    organizationId: string,
    resource: string,
  ): Promise<QuotaCheckResult> {
    // Get active subscription
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
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

    // -1 = unlimited
    if (planLimit.limitValue === -1) {
      return {
        allowed: true,
        current: 0,
        limit: -1,
        resource,
      };
    }

    // Get current usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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
}

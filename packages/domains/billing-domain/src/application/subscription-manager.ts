import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type Stripe from 'stripe';
import { subscriptions } from '../../drizzle/schema.js';
import { SubscriptionAggregate } from '../entities/subscription.js';
import { PlanService } from '../services/plan-service.js';

export class SubscriptionManager {
  private readonly planService: PlanService;

  constructor(
    private readonly db: NeonHttpDatabase<any>,
    private readonly stripe: Stripe,
  ) {
    this.planService = new PlanService(db);
  }

  async createCheckoutSession(
    organizationId: string,
    planId: string,
    interval: 'month' | 'year',
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    // Check for duplicate subscription
    const existing = await this.getSubscription(organizationId);
    SubscriptionAggregate.validateNoDuplicate(existing);

    // Get plan details
    const plan = await this.planService.getPlan(planId);

    const priceId =
      interval === 'month'
        ? plan.stripePriceIdMonthly
        : plan.stripePriceIdYearly;

    if (!priceId) {
      throw new Error(`No Stripe price configured for ${interval}ly billing`);
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organizationId,
        planId,
      },
      subscription_data: {
        metadata: {
          organizationId,
          planId,
        },
        trial_period_days: 14, // 14-day trial
      },
    });

    return session;
  }

  async cancelSubscription(organizationId: string): Promise<void> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Validate the transition through the aggregate
    const aggregate = SubscriptionAggregate.from(subscription as any);
    aggregate.cancel(); // throws if transition is invalid

    // Cancel at period end in Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local record
    await this.db
      .update(subscriptions)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));
  }

  async changeSubscription(
    organizationId: string,
    newPlanId: string,
  ): Promise<void> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Use aggregate to validate plan change
    const aggregate = SubscriptionAggregate.from(subscription as any);

    // Compare plans for upgrade/downgrade validation
    const comparison = await this.planService.comparePlans(
      subscription.planId,
      newPlanId,
    );
    aggregate.validatePlanChange(
      comparison.newPlan.priceMonthly,
      comparison.currentPlan.priceMonthly,
    );

    // Get the Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );

    // Determine which price to use based on current billing interval
    const currentInterval =
      stripeSubscription.items.data[0]?.price.recurring?.interval;
    const newPriceId =
      currentInterval === 'year'
        ? comparison.newPlan.stripePriceIdYearly
        : comparison.newPlan.stripePriceIdMonthly;

    if (!newPriceId) {
      throw new Error(
        'New plan does not have a price configured for current interval',
      );
    }

    // Update the subscription in Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        organizationId,
        planId: newPlanId,
      },
    });

    // Update local record
    await this.db
      .update(subscriptions)
      .set({
        planId: newPlanId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));
  }

  async getSubscription(organizationId: string) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    return subscription || null;
  }

  async createPortalSession(
    organizationId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error('No customer found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }
}

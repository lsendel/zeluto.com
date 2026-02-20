import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type Stripe from 'stripe';
import { invoices, subscriptions } from '../../drizzle/schema.js';

export class StripeWebhookHandler {
  constructor(private readonly db: NeonHttpDatabase<any>) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const orgId = invoice.metadata?.organizationId;
    if (!orgId) {
      console.warn('Invoice paid but no organizationId in metadata');
      return;
    }

    // Record invoice
    await this.db.insert(invoices).values({
      organizationId: orgId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      status: invoice.status || 'paid',
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
      paidAt: new Date(),
    });

    // Update subscription status to active if it was past_due
    const subscriptionId =
      ((invoice as any).subscription as string | undefined) ||
      (invoice.parent?.subscription_details?.subscription as
        | string
        | undefined);
    if (subscriptionId) {
      await this.db
        .update(subscriptions)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
    }
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const subscriptionId =
      ((invoice as any).subscription as string | undefined) ||
      (invoice.parent?.subscription_details?.subscription as
        | string
        | undefined);
    if (subscriptionId) {
      await this.db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
    }
  }

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const orgId = subscription.metadata?.organizationId;
    const planId = subscription.metadata?.planId;

    if (!orgId || !planId) {
      console.warn('Subscription created but missing metadata');
      return;
    }

    const mapStatus = (status: string): string => {
      switch (status) {
        case 'active':
          return 'active';
        case 'trialing':
          return 'trialing';
        case 'past_due':
          return 'past_due';
        case 'canceled':
          return 'canceled';
        default:
          return 'active';
      }
    };

    await this.db.insert(subscriptions).values({
      organizationId: orgId,
      planId,
      status: mapStatus(subscription.status),
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(
        ((subscription as any).current_period_start || 0) * 1000,
      ),
      currentPeriodEnd: new Date(
        ((subscription as any).current_period_end || 0) * 1000,
      ),
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    });
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const mapStatus = (status: string): string => {
      switch (status) {
        case 'active':
          return 'active';
        case 'trialing':
          return 'trialing';
        case 'past_due':
          return 'past_due';
        case 'canceled':
          return 'canceled';
        default:
          return 'past_due';
      }
    };

    await this.db
      .update(subscriptions)
      .set({
        status: mapStatus(subscription.status),
        currentPeriodStart: new Date(
          ((subscription as any).current_period_start || 0) * 1000,
        ),
        currentPeriodEnd: new Date(
          ((subscription as any).current_period_end || 0) * 1000,
        ),
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    // The subscription.created event will handle the actual subscription creation
    // This event can be used for additional tracking or notifications
    console.log(`Checkout session completed for customer: ${session.customer}`);
  }
}

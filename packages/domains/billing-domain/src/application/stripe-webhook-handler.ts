import type Stripe from 'stripe';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { subscriptions, invoices } from '../../drizzle/schema.js';

export class StripeWebhookHandler {
  constructor(private db: NodePgDatabase<any>) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
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
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      paidAt: new Date(),
    });

    // Update subscription status to active if it was past_due
    if (invoice.subscription) {
      await this.db
        .update(subscriptions)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      await this.db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const orgId = subscription.metadata?.organizationId;
    const planId = subscription.metadata?.planId;

    if (!orgId || !planId) {
      console.warn('Subscription created but missing metadata');
      return;
    }

    await this.db.insert(subscriptions).values({
      organizationId: orgId,
      planId,
      status: subscription.status === 'active' ? 'active' : subscription.status === 'trialing' ? 'trialing' : 'active',
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status: subscription.status === 'active' ? 'active' : subscription.status === 'trialing' ? 'trialing' : subscription.status === 'canceled' ? 'canceled' : 'past_due',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    // The subscription.created event will handle the actual subscription creation
    // This event can be used for additional tracking or notifications
    console.log(`Checkout session completed for customer: ${session.customer}`);
  }
}

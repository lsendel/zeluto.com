import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createEvent,
  findEventByProviderMessageId,
} from '../infrastructure/repositories/delivery-event-repository.js';
import { createSuppression } from '../infrastructure/repositories/suppression-repository.js';

export const trackingRoutes = new Hono<Env>();

// ---------------------------------------------------------------------------
// SES Webhook (SNS Notification)
// POST /api/v1/delivery/tracking/ses
// ---------------------------------------------------------------------------
trackingRoutes.post('/api/v1/delivery/tracking/ses', async (c) => {
  const db = c.get('db');

  try {
    const rawBody = await c.req.text();
    const payload = JSON.parse(rawBody);

    // Handle SNS SubscriptionConfirmation
    if (payload.Type === 'SubscriptionConfirmation' && payload.SubscribeURL) {
      await fetch(payload.SubscribeURL);
      return c.json({ received: true });
    }

    // Handle SNS Notification
    if (payload.Type === 'Notification') {
      const message = JSON.parse(payload.Message);
      const notificationType = message.notificationType || message.eventType;

      let eventType: string;
      switch (notificationType) {
        case 'Delivery':
          eventType = 'delivered';
          break;
        case 'Bounce':
          eventType = 'bounced';
          break;
        case 'Complaint':
          eventType = 'complained';
          break;
        case 'Open':
          eventType = 'opened';
          break;
        case 'Click':
          eventType = 'clicked';
          break;
        default:
          eventType = 'sent';
      }

      const messageId = message.mail?.messageId;
      if (messageId) {
        // Look up the original event to get org/job context
        const originalEvent = await findEventByProviderMessageId(db, messageId);
        if (originalEvent) {
          await createEvent(db, originalEvent.organization_id, {
            job_id: originalEvent.job_id,
            contact_id: originalEvent.contact_id,
            channel: 'email',
            event_type: eventType,
            provider_message_id: messageId,
            metadata: {
              source: 'ses',
              raw: message,
            },
          });

          // Auto-suppress on hard bounce or complaint
          if (eventType === 'bounced' || eventType === 'complained') {
            const recipients =
              message.bounce?.bouncedRecipients ||
              message.complaint?.complainedRecipients ||
              [];
            for (const recipient of recipients) {
              const email = recipient.emailAddress;
              if (email) {
                try {
                  await createSuppression(db, originalEvent.organization_id, {
                    email,
                    reason: eventType === 'bounced' ? 'bounce' : 'complaint',
                    source: 'ses-webhook',
                  });
                } catch {
                  // Ignore duplicate suppression errors
                }
              }
            }
          }
        }
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('SES webhook error:', error);
    return c.json({ received: true });
  }
});

// ---------------------------------------------------------------------------
// SendGrid Event Webhook
// POST /api/v1/delivery/tracking/sendgrid
// ---------------------------------------------------------------------------
trackingRoutes.post('/api/v1/delivery/tracking/sendgrid', async (c) => {
  const db = c.get('db');

  try {
    const events =
      await c.req.json<
        Array<{
          event: string;
          sg_message_id?: string;
          email?: string;
          timestamp?: number;
          url?: string;
          useragent?: string;
          [key: string]: unknown;
        }>
      >();

    if (!Array.isArray(events)) {
      return c.json({ received: true });
    }

    for (const event of events) {
      let eventType: string;
      switch (event.event) {
        case 'delivered':
          eventType = 'delivered';
          break;
        case 'bounce':
        case 'dropped':
          eventType = 'bounced';
          break;
        case 'spamreport':
          eventType = 'complained';
          break;
        case 'open':
          eventType = 'opened';
          break;
        case 'click':
          eventType = 'clicked';
          break;
        case 'unsubscribe':
        case 'group_unsubscribe':
          eventType = 'unsubscribed';
          break;
        default:
          continue; // Skip unknown events
      }

      const messageId = event.sg_message_id?.split('.')[0]; // Strip filter ID suffix
      if (messageId) {
        const originalEvent = await findEventByProviderMessageId(db, messageId);
        if (originalEvent) {
          await createEvent(db, originalEvent.organization_id, {
            job_id: originalEvent.job_id,
            contact_id: originalEvent.contact_id,
            channel: 'email',
            event_type: eventType,
            provider_message_id: messageId,
            metadata: {
              source: 'sendgrid',
              url: event.url,
              useragent: event.useragent,
              raw: event,
            },
          });

          // Auto-suppress on bounce, complaint, or unsubscribe
          if (
            (eventType === 'bounced' ||
              eventType === 'complained' ||
              eventType === 'unsubscribed') &&
            event.email
          ) {
            const reason =
              eventType === 'bounced'
                ? 'bounce'
                : eventType === 'complained'
                  ? 'complaint'
                  : 'unsubscribe';
            try {
              await createSuppression(db, originalEvent.organization_id, {
                email: event.email,
                reason,
                source: 'sendgrid-webhook',
              });
            } catch {
              // Ignore duplicate suppression errors
            }
          }
        }
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return c.json({ received: true });
  }
});

// ---------------------------------------------------------------------------
// Twilio Status Callback
// POST /api/v1/delivery/tracking/twilio
// ---------------------------------------------------------------------------
trackingRoutes.post('/api/v1/delivery/tracking/twilio', async (c) => {
  const db = c.get('db');

  try {
    // Twilio sends form-encoded data
    const formData = await c.req.parseBody();

    const messageSid = formData.MessageSid as string | undefined;
    const messageStatus = formData.MessageStatus as string | undefined;
    const errorCode = formData.ErrorCode as string | undefined;

    if (!messageSid || !messageStatus) {
      return c.json({ received: true });
    }

    let eventType: string;
    switch (messageStatus) {
      case 'delivered':
        eventType = 'delivered';
        break;
      case 'sent':
        eventType = 'sent';
        break;
      case 'failed':
      case 'undelivered':
        eventType = 'bounced';
        break;
      default:
        return c.json({ received: true });
    }

    const originalEvent = await findEventByProviderMessageId(db, messageSid);
    if (originalEvent) {
      await createEvent(db, originalEvent.organization_id, {
        job_id: originalEvent.job_id,
        contact_id: originalEvent.contact_id,
        channel: 'sms',
        event_type: eventType,
        provider_message_id: messageSid,
        metadata: {
          source: 'twilio',
          errorCode,
          messageStatus,
        },
      });
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return c.json({ received: true });
  }
});

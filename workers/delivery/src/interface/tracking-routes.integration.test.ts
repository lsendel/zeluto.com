import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import {
  createEvent,
  findEventByProviderMessageId,
} from '../infrastructure/repositories/delivery-event-repository.js';
import { createSuppression } from '../infrastructure/repositories/suppression-repository.js';
import { trackingRoutes } from './tracking-routes.js';

vi.mock('../infrastructure/repositories/delivery-event-repository.js', () => ({
  createEvent: vi.fn(),
  findEventByProviderMessageId: vi.fn(),
}));

vi.mock('../infrastructure/repositories/suppression-repository.js', () => ({
  createSuppression: vi.fn(),
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';

function originalEvent() {
  return {
    organization_id: ORG_ID,
    job_id: JOB_ID,
    contact_id: CONTACT_ID,
  };
}

function createTestApp() {
  const app = new Hono<{
    Bindings: Env['Bindings'];
    Variables: Env['Variables'];
  }>();
  // Tracking routes don't need real tenant context
  app.use('/api/v1/delivery/tracking/*', async (c, next) => {
    c.set('tenant', {} as never);
    c.set('db', {} as never);
    await next();
  });
  app.route('/', trackingRoutes);
  return app;
}

function baseEnv(): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: {} as KVNamespace,
    EVENTS: {} as Queue,
    ENCRYPTION_KEY: 'test-key',
  };
}

describe('tracking routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createEvent).mockResolvedValue({} as never);
    vi.mocked(createSuppression).mockResolvedValue({} as never);
  });

  // ── SES Webhooks ──────────────────────────────────────

  describe('POST /api/v1/delivery/tracking/ses', () => {
    it('handles SNS SubscriptionConfirmation', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('ok'),
      );

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/tracking/ses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Type: 'SubscriptionConfirmation',
            SubscribeURL: 'https://sns.example.com/confirm',
          }),
        },
        baseEnv(),
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledWith('https://sns.example.com/confirm');
      fetchSpy.mockRestore();
    });

    it('maps Delivery notification to delivered event', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/tracking/ses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Type: 'Notification',
            Message: JSON.stringify({
              notificationType: 'Delivery',
              mail: { messageId: 'ses-msg-001' },
            }),
          }),
        },
        baseEnv(),
      );

      expect(response.status).toBe(200);
      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({
          event_type: 'delivered',
          provider_message_id: 'ses-msg-001',
          channel: 'email',
        }),
      );
    });

    it('maps Bounce notification and auto-suppresses recipients', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/ses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Type: 'Notification',
            Message: JSON.stringify({
              notificationType: 'Bounce',
              bounce: {
                bounceType: 'Permanent',
                bouncedRecipients: [
                  { emailAddress: 'bad@example.com' },
                  { emailAddress: 'invalid@example.com' },
                ],
              },
              mail: { messageId: 'ses-msg-002' },
            }),
          }),
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({ event_type: 'bounced' }),
      );
      expect(createSuppression).toHaveBeenCalledTimes(2);
      expect(createSuppression).toHaveBeenCalledWith({}, ORG_ID, {
        email: 'bad@example.com',
        reason: 'bounce',
        source: 'ses-webhook',
      });
    });

    it('maps Complaint notification and auto-suppresses', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/ses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Type: 'Notification',
            Message: JSON.stringify({
              notificationType: 'Complaint',
              complaint: {
                complainedRecipients: [
                  { emailAddress: 'reporter@example.com' },
                ],
              },
              mail: { messageId: 'ses-msg-003' },
            }),
          }),
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({ event_type: 'complained' }),
      );
      expect(createSuppression).toHaveBeenCalledWith({}, ORG_ID, {
        email: 'reporter@example.com',
        reason: 'complaint',
        source: 'ses-webhook',
      });
    });

    it('maps Open and Click notifications', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();

      await app.request(
        'http://localhost/api/v1/delivery/tracking/ses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Type: 'Notification',
            Message: JSON.stringify({
              notificationType: 'Open',
              mail: { messageId: 'ses-msg-004' },
            }),
          }),
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({ event_type: 'opened' }),
      );
    });

    it('ignores unknown notification types gracefully', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/tracking/ses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Type: 'Notification',
            Message: JSON.stringify({
              notificationType: 'UnknownType',
              mail: { messageId: 'ses-msg-005' },
            }),
          }),
        },
        baseEnv(),
      );

      expect(response.status).toBe(200);
      // Falls through to 'sent' default
      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({ event_type: 'sent' }),
      );
    });
  });

  // ── SendGrid Webhooks ────────────────────────────────

  describe('POST /api/v1/delivery/tracking/sendgrid', () => {
    it('processes array of mixed event types', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { event: 'delivered', sg_message_id: 'sg-001.filter123' },
            { event: 'open', sg_message_id: 'sg-002.filter456' },
            { event: 'click', sg_message_id: 'sg-003.filter789', url: 'https://example.com' },
          ]),
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledTimes(3);
      expect(findEventByProviderMessageId).toHaveBeenCalledWith({}, 'sg-001');
      expect(findEventByProviderMessageId).toHaveBeenCalledWith({}, 'sg-002');
      expect(findEventByProviderMessageId).toHaveBeenCalledWith({}, 'sg-003');
    });

    it('strips filter ID suffix from sg_message_id', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { event: 'delivered', sg_message_id: 'abc123.def456.ghi789' },
          ]),
        },
        baseEnv(),
      );

      expect(findEventByProviderMessageId).toHaveBeenCalledWith({}, 'abc123');
    });

    it('maps bounce and dropped to bounced', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { event: 'bounce', sg_message_id: 'sg-b1', email: 'bounced@test.com' },
            { event: 'dropped', sg_message_id: 'sg-d1', email: 'dropped@test.com' },
          ]),
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(createEvent).mock.calls;
      expect(calls[0][2]).toEqual(expect.objectContaining({ event_type: 'bounced' }));
      expect(calls[1][2]).toEqual(expect.objectContaining({ event_type: 'bounced' }));
      expect(createSuppression).toHaveBeenCalledTimes(2);
    });

    it('maps spamreport to complained and suppresses', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { event: 'spamreport', sg_message_id: 'sg-spam', email: 'spam@test.com' },
          ]),
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({ event_type: 'complained' }),
      );
      expect(createSuppression).toHaveBeenCalledWith({}, ORG_ID, {
        email: 'spam@test.com',
        reason: 'complaint',
        source: 'sendgrid-webhook',
      });
    });

    it('maps unsubscribe and group_unsubscribe', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { event: 'unsubscribe', sg_message_id: 'sg-u1', email: 'unsub@test.com' },
            { event: 'group_unsubscribe', sg_message_id: 'sg-u2', email: 'grp@test.com' },
          ]),
        },
        baseEnv(),
      );

      const calls = vi.mocked(createEvent).mock.calls;
      expect(calls[0][2]).toEqual(expect.objectContaining({ event_type: 'unsubscribed' }));
      expect(calls[1][2]).toEqual(expect.objectContaining({ event_type: 'unsubscribed' }));
      expect(createSuppression).toHaveBeenCalledTimes(2);
    });

    it('skips unknown event types', async () => {
      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { event: 'deferred', sg_message_id: 'sg-defer' },
            { event: 'processed', sg_message_id: 'sg-proc' },
          ]),
        },
        baseEnv(),
      );

      expect(createEvent).not.toHaveBeenCalled();
    });

    it('handles non-array payload gracefully', async () => {
      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/tracking/sendgrid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'delivered' }),
        },
        baseEnv(),
      );

      expect(response.status).toBe(200);
      expect(createEvent).not.toHaveBeenCalled();
    });
  });

  // ── Twilio Webhooks ──────────────────────────────────

  describe('POST /api/v1/delivery/tracking/twilio', () => {
    it('maps delivered status to delivered event', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/twilio',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'MessageSid=SM001&MessageStatus=delivered',
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({
          event_type: 'delivered',
          channel: 'sms',
          provider_message_id: 'SM001',
        }),
      );
    });

    it('maps failed and undelivered to bounced', async () => {
      vi.mocked(findEventByProviderMessageId).mockResolvedValue(
        originalEvent() as never,
      );

      const app = createTestApp();
      await app.request(
        'http://localhost/api/v1/delivery/tracking/twilio',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'MessageSid=SM002&MessageStatus=failed&ErrorCode=30003',
        },
        baseEnv(),
      );

      expect(createEvent).toHaveBeenCalledWith(
        {},
        ORG_ID,
        expect.objectContaining({
          event_type: 'bounced',
          metadata: expect.objectContaining({
            source: 'twilio',
            errorCode: '30003',
            messageStatus: 'failed',
          }),
        }),
      );
    });

    it('ignores statuses like queued/sending', async () => {
      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/tracking/twilio',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'MessageSid=SM003&MessageStatus=queued',
        },
        baseEnv(),
      );

      expect(response.status).toBe(200);
      expect(createEvent).not.toHaveBeenCalled();
    });

    it('ignores missing MessageSid or MessageStatus', async () => {
      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/tracking/twilio',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'SomeOtherField=value',
        },
        baseEnv(),
      );

      expect(response.status).toBe(200);
      expect(createEvent).not.toHaveBeenCalled();
    });
  });
});

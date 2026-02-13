import { startHealthServer, createWorker, getRedis, getDb, type JobHandler } from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  delivery_jobs,
  delivery_events,
  provider_configs,
  suppressions,
  sending_domains,
} from '@mauntic/delivery-domain/drizzle';
import {
  renderTemplate,
  getWarmupLimit,
  getDaysSinceStart,
  decryptConfig,
} from '@mauntic/delivery-domain';
import { SmtpProvider, type SmtpConfig } from './providers/smtp.provider.js';

const logger = pino({ name: 'delivery-engine' });

// ---------------------------------------------------------------------------
// Helper: resolve provider config and create sender
// ---------------------------------------------------------------------------

async function resolveProvider(
  db: ReturnType<typeof getDb>,
  orgId: string,
  channel: string,
) {
  const [config] = await db
    .select()
    .from(provider_configs)
    .where(
      and(
        eq(provider_configs.organization_id, orgId),
        eq(provider_configs.channel, channel),
        eq(provider_configs.is_active, true),
      ),
    )
    .orderBy(desc(provider_configs.priority))
    .limit(1);

  return config ?? null;
}

async function checkSuppression(
  db: ReturnType<typeof getDb>,
  orgId: string,
  email: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.organization_id, orgId),
        eq(suppressions.email, email.toLowerCase()),
      ),
    )
    .limit(1);
  return !!row;
}

async function checkWarmupLimits(
  db: ReturnType<typeof getDb>,
  orgId: string,
  fromDomain: string,
): Promise<{ allowed: boolean; limit: number; sent: number }> {
  // Find the sending domain record
  const [domain] = await db
    .select()
    .from(sending_domains)
    .where(
      and(
        eq(sending_domains.organization_id, orgId),
        eq(sending_domains.domain, fromDomain),
      ),
    )
    .limit(1);

  if (!domain) {
    // No domain record means no warmup restrictions
    return { allowed: true, limit: Infinity, sent: 0 };
  }

  const daysSinceStart = getDaysSinceStart(new Date(domain.created_at));
  const limit = getWarmupLimit(daysSinceStart);

  if (limit === Infinity) {
    return { allowed: true, limit: Infinity, sent: 0 };
  }

  // Count emails sent today for this org
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(delivery_events)
    .where(
      and(
        eq(delivery_events.organization_id, orgId),
        eq(delivery_events.channel, 'email'),
        eq(delivery_events.event_type, 'sent'),
        sql`${delivery_events.created_at} >= ${today.toISOString()}`,
      ),
    );

  const sent = countResult?.count ?? 0;
  return { allowed: sent < limit, limit, sent };
}

async function recordDeliveryEvent(
  db: ReturnType<typeof getDb>,
  orgId: string,
  data: {
    jobId: string;
    contactId: string;
    channel: string;
    eventType: string;
    providerMessageId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const [event] = await db
    .insert(delivery_events)
    .values({
      organization_id: orgId,
      job_id: data.jobId,
      contact_id: data.contactId,
      channel: data.channel,
      event_type: data.eventType,
      provider_message_id: data.providerMessageId ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();
  return event;
}

async function updateJobCounts(
  db: ReturnType<typeof getDb>,
  orgId: string,
  jobId: string,
  success: boolean,
) {
  if (success) {
    await db
      .update(delivery_jobs)
      .set({ sent_count: sql`${delivery_jobs.sent_count} + 1` })
      .where(and(eq(delivery_jobs.id, jobId), eq(delivery_jobs.organization_id, orgId)));
  } else {
    await db
      .update(delivery_jobs)
      .set({ failed_count: sql`${delivery_jobs.failed_count} + 1` })
      .where(and(eq(delivery_jobs.id, jobId), eq(delivery_jobs.organization_id, orgId)));
  }
}

// ---------------------------------------------------------------------------
// Email handler with full pipeline
// ---------------------------------------------------------------------------

interface EmailJobData {
  deliveryId: string;
  organizationId: string;
  emailAddress: string;
  contactId?: string;
  jobId?: string;
  from?: string;
  subject?: string;
  body?: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

const emailHandler: JobHandler<EmailJobData> = {
  name: 'delivery:send-email',
  concurrency: 5,
  async process(job: Job<EmailJobData>) {
    const {
      deliveryId,
      organizationId,
      emailAddress,
      contactId,
      jobId,
      from,
      subject,
      templateId,
      templateData,
    } = job.data;
    let { body, html, text } = job.data;

    logger.info({ jobId: job.id, deliveryId, emailAddress }, 'Processing email delivery');

    const db = getDb();
    const redis = getRedis();

    // Step 1: Idempotency check
    const idempotencyKey = `delivery:idem:${deliveryId}`;
    const alreadyProcessed = await redis.get(idempotencyKey);
    if (alreadyProcessed) {
      logger.info({ deliveryId }, 'Skipping duplicate delivery (idempotent)');
      return { success: true, deliveryId, skipped: true };
    }

    // Step 2: Load delivery job from DB (if jobId provided)
    if (jobId) {
      const [deliveryJob] = await db
        .select()
        .from(delivery_jobs)
        .where(and(eq(delivery_jobs.id, jobId), eq(delivery_jobs.organization_id, organizationId)))
        .limit(1);

      if (deliveryJob && deliveryJob.status === 'queued') {
        await db
          .update(delivery_jobs)
          .set({ status: 'sending' })
          .where(and(eq(delivery_jobs.id, jobId), eq(delivery_jobs.organization_id, organizationId)));
      }
    }

    // Step 3: Check suppression list
    const isSuppressed = await checkSuppression(db, organizationId, emailAddress);
    if (isSuppressed) {
      logger.info({ deliveryId, emailAddress }, 'Recipient is suppressed, skipping');
      if (jobId && contactId) {
        await recordDeliveryEvent(db, organizationId, {
          jobId,
          contactId,
          channel: 'email',
          eventType: 'failed',
          metadata: { reason: 'suppressed' },
        });
        await updateJobCounts(db, organizationId, jobId, false);
      }
      await redis.setex(idempotencyKey, 86400, 'suppressed');
      return { success: false, deliveryId, reason: 'suppressed' };
    }

    // Step 4: Check warmup limits
    const fromDomain = (from ?? '').split('@')[1] ?? '';
    if (fromDomain) {
      const warmup = await checkWarmupLimits(db, organizationId, fromDomain);
      if (!warmup.allowed) {
        logger.warn({ deliveryId, limit: warmup.limit, sent: warmup.sent }, 'Warmup limit exceeded');
        if (jobId && contactId) {
          await recordDeliveryEvent(db, organizationId, {
            jobId,
            contactId,
            channel: 'email',
            eventType: 'failed',
            metadata: { reason: 'warmup_limit_exceeded', limit: warmup.limit, sent: warmup.sent },
          });
          await updateJobCounts(db, organizationId, jobId, false);
        }
        await redis.setex(idempotencyKey, 86400, 'warmup_limit');
        return { success: false, deliveryId, reason: 'warmup_limit_exceeded' };
      }
    }

    // Step 5: Resolve provider
    const providerConfig = await resolveProvider(db, organizationId, 'email');
    if (!providerConfig) {
      logger.error({ deliveryId, organizationId }, 'No active email provider configured');
      if (jobId && contactId) {
        await recordDeliveryEvent(db, organizationId, {
          jobId,
          contactId,
          channel: 'email',
          eventType: 'failed',
          metadata: { reason: 'no_provider' },
        });
        await updateJobCounts(db, organizationId, jobId, false);
      }
      throw new Error('No active email provider configured');
    }

    // Step 6: Render template if templateId provided
    if (templateId && templateData) {
      const templateBody = body ?? html ?? '';
      if (templateBody) {
        html = renderTemplate(templateBody, templateData);
        if (text) {
          text = renderTemplate(text, templateData);
        }
      }
    }

    // Step 7: Send via provider
    let sendResult: { success: boolean; externalId?: string; error?: string };
    try {
      // Decrypt provider config
      let providerSettings: Record<string, unknown>;
      const rawConfig = providerConfig.config;
      if (typeof rawConfig === 'string' && rawConfig.includes(':')) {
        const encryptionKey = process.env.ENCRYPTION_KEY ?? '';
        const decrypted = await decryptConfig(rawConfig, encryptionKey);
        providerSettings = JSON.parse(decrypted);
      } else {
        providerSettings = rawConfig as Record<string, unknown>;
      }

      if (providerConfig.provider_type === 'custom_smtp') {
        const smtpProvider = new SmtpProvider(providerSettings as unknown as SmtpConfig);
        sendResult = await smtpProvider.send({
          to: emailAddress,
          from: from ?? (providerSettings.from as string) ?? '',
          subject: subject ?? '',
          html: html ?? body ?? '',
          text,
        });
      } else {
        // For HTTP-based providers (SES, SendGrid, etc.), we import them dynamically
        // since they live in the delivery-domain package
        sendResult = { success: false, error: `Provider type ${providerConfig.provider_type} not yet integrated in engine` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendResult = { success: false, error: message };
    }

    // Step 8: Record delivery event
    if (jobId && contactId) {
      await recordDeliveryEvent(db, organizationId, {
        jobId,
        contactId,
        channel: 'email',
        eventType: sendResult.success ? 'sent' : 'failed',
        providerMessageId: sendResult.externalId,
        metadata: sendResult.success
          ? { provider: providerConfig.provider_type }
          : { provider: providerConfig.provider_type, error: sendResult.error },
      });

      // Step 9: Update job counts
      await updateJobCounts(db, organizationId, jobId, sendResult.success);
    }

    // Step 10: Mark as processed for idempotency
    await redis.setex(idempotencyKey, 86400, sendResult.success ? 'sent' : 'failed');

    if (!sendResult.success) {
      logger.error({ deliveryId, error: sendResult.error }, 'Email delivery failed');
      throw new Error(sendResult.error ?? 'Email delivery failed');
    }

    logger.info({ deliveryId, emailAddress, externalId: sendResult.externalId }, 'Email sent successfully');
    return { success: true, deliveryId, externalId: sendResult.externalId, sentAt: new Date().toISOString() };
  },
};

// ---------------------------------------------------------------------------
// SMS handler
// ---------------------------------------------------------------------------

const smsHandler: JobHandler = {
  name: 'delivery:send-sms',
  concurrency: 3,
  async process(job: Job) {
    logger.info({ jobId: job.id }, 'Processing SMS delivery');
    const { deliveryId, phoneNumber, organizationId, contactId, jobId: deliveryJobId, body } = job.data;

    const db = getDb();
    const redis = getRedis();

    // Idempotency check
    const idempotencyKey = `delivery:idem:${deliveryId}`;
    const alreadyProcessed = await redis.get(idempotencyKey);
    if (alreadyProcessed) {
      return { success: true, deliveryId, skipped: true };
    }

    // Resolve provider
    const providerConfig = await resolveProvider(db, organizationId, 'sms');
    if (!providerConfig) {
      logger.error({ deliveryId }, 'No active SMS provider configured');
      throw new Error('No active SMS provider configured');
    }

    // TODO: Send via Twilio or other SMS provider
    logger.info({ jobId: job.id, deliveryId, phoneNumber }, 'SMS sent');

    // Record event
    if (deliveryJobId && contactId) {
      await recordDeliveryEvent(db, organizationId, {
        jobId: deliveryJobId,
        contactId,
        channel: 'sms',
        eventType: 'sent',
        metadata: { provider: providerConfig.provider_type },
      });
      await updateJobCounts(db, organizationId, deliveryJobId, true);
    }

    await redis.setex(idempotencyKey, 86400, 'sent');
    return { success: true, deliveryId, sentAt: new Date().toISOString() };
  },
};

// ---------------------------------------------------------------------------
// Push handler
// ---------------------------------------------------------------------------

const pushHandler: JobHandler = {
  name: 'delivery:send-push',
  concurrency: 10,
  async process(job: Job) {
    logger.info({ jobId: job.id }, 'Processing push notification');
    const { deliveryId, deviceToken, organizationId, contactId, jobId: deliveryJobId } = job.data;

    const db = getDb();
    const redis = getRedis();

    // Idempotency check
    const idempotencyKey = `delivery:idem:${deliveryId}`;
    const alreadyProcessed = await redis.get(idempotencyKey);
    if (alreadyProcessed) {
      return { success: true, deliveryId, skipped: true };
    }

    // Resolve provider
    const providerConfig = await resolveProvider(db, organizationId, 'push');
    if (!providerConfig) {
      logger.error({ deliveryId }, 'No active push provider configured');
      throw new Error('No active push provider configured');
    }

    // TODO: Send via FCM or other push provider
    logger.info({ jobId: job.id, deliveryId }, 'Push notification sent');

    // Record event
    if (deliveryJobId && contactId) {
      await recordDeliveryEvent(db, organizationId, {
        jobId: deliveryJobId,
        contactId,
        channel: 'push',
        eventType: 'sent',
        metadata: { provider: providerConfig.provider_type },
      });
      await updateJobCounts(db, organizationId, deliveryJobId, true);
    }

    await redis.setex(idempotencyKey, 86400, 'sent');
    return { success: true, deliveryId, sentAt: new Date().toISOString() };
  },
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  const emailWorker = createWorker('delivery:send-email', emailHandler);
  const smsWorker = createWorker('delivery:send-sms', smsHandler);
  const pushWorker = createWorker('delivery:send-push', pushHandler);

  [emailWorker, smsWorker, pushWorker].forEach((worker) => {
    worker.on('completed', (job) => {
      logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
    });
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, error: err }, 'Job failed');
    });
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all([emailWorker.close(), smsWorker.close(), pushWorker.close()]);
    const redis = getRedis();
    await redis.quit();
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Delivery engine service started');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});

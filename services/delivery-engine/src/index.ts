import { startHealthServer, createWorker, getRedis, type JobHandler } from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';

const logger = pino({ name: 'delivery-engine' });

const emailHandler: JobHandler = {
  name: 'delivery:send-email',
  concurrency: 5,
  async process(job: Job) {
    logger.info({ jobId: job.id }, 'Processing email delivery');
    const { deliveryId, emailAddress } = job.data;
    try {
      // TODO: Load provider config, send via provider, record delivery event
      logger.info({ jobId: job.id, deliveryId, emailAddress }, 'Email sent');
      return { success: true, deliveryId, sentAt: new Date().toISOString() };
    } catch (error) {
      logger.error({ jobId: job.id, error, deliveryId }, 'Email delivery failed');
      throw error;
    }
  },
};

const smsHandler: JobHandler = {
  name: 'delivery:send-sms',
  concurrency: 3,
  async process(job: Job) {
    logger.info({ jobId: job.id }, 'Processing SMS delivery');
    const { deliveryId, phoneNumber } = job.data;
    try {
      // TODO: Load provider config, send via provider, record delivery event
      logger.info({ jobId: job.id, deliveryId, phoneNumber }, 'SMS sent');
      return { success: true, deliveryId, sentAt: new Date().toISOString() };
    } catch (error) {
      logger.error({ jobId: job.id, error, deliveryId }, 'SMS delivery failed');
      throw error;
    }
  },
};

const pushHandler: JobHandler = {
  name: 'delivery:send-push',
  concurrency: 10,
  async process(job: Job) {
    logger.info({ jobId: job.id }, 'Processing push notification');
    const { deliveryId, deviceToken } = job.data;
    try {
      // TODO: Load provider config, send via provider, record delivery event
      logger.info({ jobId: job.id, deliveryId }, 'Push notification sent');
      return { success: true, deliveryId, sentAt: new Date().toISOString() };
    } catch (error) {
      logger.error({ jobId: job.id, error, deliveryId }, 'Push delivery failed');
      throw error;
    }
  },
};

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

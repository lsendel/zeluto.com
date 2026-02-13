import { Worker, Queue, type Job } from 'bullmq';
import { getRedis } from '../redis/connection.js';

export interface JobHandler<TData = unknown, TResult = void> {
  name: string;
  process(job: Job<TData>): Promise<TResult>;
  concurrency?: number;
}

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: getRedis() as any });
}

export function createWorker<TData>(
  queueName: string,
  handler: JobHandler<TData>,
): Worker<TData> {
  return new Worker<TData>(
    queueName,
    async (job) => {
      const redis = getRedis();
      const idempotencyKey = `idem:${queueName}:${job.id}`;
      const existing = await redis.get(idempotencyKey);
      if (existing) return;
      const result = await handler.process(job);
      await redis.setex(idempotencyKey, 86400, '1');
      return result;
    },
    { connection: getRedis() as any, concurrency: handler.concurrency ?? 5 },
  );
}

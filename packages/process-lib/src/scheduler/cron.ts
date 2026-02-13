import { Queue } from 'bullmq';
import { getRedis } from '../redis/connection.js';

export interface ScheduledJob {
  name: string;
  pattern: string;
  data?: Record<string, unknown>;
}

export async function registerScheduledJobs(queueName: string, jobs: ScheduledJob[]): Promise<Queue> {
  const queue = new Queue(queueName, { connection: getRedis() as any });
  for (const job of jobs) {
    await queue.upsertJobScheduler(job.name, { pattern: job.pattern }, { data: job.data ?? {} });
  }
  return queue;
}

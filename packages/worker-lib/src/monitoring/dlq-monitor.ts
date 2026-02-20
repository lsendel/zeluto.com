import type { Logger } from '../logger/index.js';

export interface DlqMonitorConfig {
  /** Webhook URL for Slack/Discord/etc. alert notifications */
  alertWebhookUrl?: string;
  /** Email address for alert notifications (via API) */
  alertEmail?: string;
  /** How often to check DLQ depth in milliseconds (default: 60000) */
  checkIntervalMs?: number;
  /** Threshold message count that triggers an alert (default: 10) */
  alertThreshold?: number;
}

export interface DlqMessage<T = unknown> {
  id: string;
  body: T;
  timestamp: string;
  attempts: number;
  error?: string;
}

export interface DlqStats {
  queueName: string;
  depth: number;
  oldestMessageAge?: number;
  checkedAt: string;
}

/**
 * Check the depth of a dead-letter queue stored in KV.
 *
 * DLQ messages are stored as KV entries with prefix `dlq:{queueName}:`.
 * Returns the count of messages currently in the DLQ.
 */
export async function checkDlqDepth(
  kv: KVNamespace,
  queueName: string,
): Promise<number> {
  const prefix = `dlq:${queueName}:`;
  const list = await kv.list({ prefix });
  return list.keys.length;
}

/**
 * Get detailed stats for a DLQ.
 */
export async function getDlqStats(
  kv: KVNamespace,
  queueName: string,
): Promise<DlqStats> {
  const prefix = `dlq:${queueName}:`;
  const list = await kv.list({ prefix });

  let oldestMessageAge: number | undefined;

  if (list.keys.length > 0) {
    // KV list returns keys sorted, check first key for oldest message
    const firstKey = list.keys[0];
    const value = await kv.get(firstKey.name);
    if (value) {
      try {
        const msg = JSON.parse(value) as DlqMessage;
        if (msg.timestamp) {
          oldestMessageAge = Date.now() - new Date(msg.timestamp).getTime();
        }
      } catch {
        // Ignore parse errors for stats
      }
    }
  }

  return {
    queueName,
    depth: list.keys.length,
    oldestMessageAge,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Replay messages from a dead-letter queue back to the main queue.
 *
 * Reads DLQ messages from KV, re-enqueues them to the target CF Queue,
 * and removes them from the DLQ on success.
 *
 * @param kv - KV namespace containing DLQ messages
 * @param queueName - Name of the DLQ (used as KV prefix)
 * @param targetQueue - CF Queue to re-enqueue messages into
 * @param count - Max number of messages to replay (default: all)
 * @returns Number of messages successfully replayed
 */
export async function replayDlqMessages<T = unknown>(
  kv: KVNamespace,
  queueName: string,
  targetQueue: Queue<T>,
  count?: number,
): Promise<number> {
  const prefix = `dlq:${queueName}:`;
  const list = await kv.list({ prefix, limit: count ?? 100 });
  let replayed = 0;

  for (const key of list.keys) {
    const value = await kv.get(key.name);
    if (!value) continue;

    try {
      const msg = JSON.parse(value) as DlqMessage<T>;
      await targetQueue.send(msg.body);
      await kv.delete(key.name);
      replayed++;
    } catch {}
  }

  return replayed;
}

/**
 * Store a failed message in the DLQ (KV-based).
 *
 * Called by queue consumers when a message exhausts retries.
 */
export async function moveToDlq<T = unknown>(
  kv: KVNamespace,
  queueName: string,
  messageId: string,
  body: T,
  error?: string,
): Promise<void> {
  const dlqMessage: DlqMessage<T> = {
    id: messageId,
    body,
    timestamp: new Date().toISOString(),
    attempts: 0,
    error,
  };

  await kv.put(
    `dlq:${queueName}:${messageId}`,
    JSON.stringify(dlqMessage),
    { expirationTtl: 60 * 60 * 24 * 7 }, // 7 days TTL
  );
}

/**
 * Send an alert when DLQ depth exceeds threshold.
 *
 * Supports Slack-compatible webhook (JSON payload with "text" field)
 * and generic webhook with structured JSON.
 */
export async function sendDlqAlert(
  config: DlqMonitorConfig,
  stats: DlqStats,
  logger?: Logger,
): Promise<void> {
  const message =
    `DLQ Alert: ${stats.queueName} has ${stats.depth} messages pending. ` +
    `Oldest message age: ${stats.oldestMessageAge ? `${Math.round(stats.oldestMessageAge / 1000)}s` : 'unknown'}`;

  if (config.alertWebhookUrl) {
    try {
      await fetch(config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*DLQ Alert*\n*Queue:* ${stats.queueName}\n*Depth:* ${stats.depth}\n*Checked:* ${stats.checkedAt}`,
              },
            },
          ],
        }),
      });
    } catch (err) {
      logger?.error(
        { error: String(err), queueName: stats.queueName },
        'Failed to send DLQ webhook alert',
      );
    }
  }

  // Always log the alert
  logger?.warn(
    {
      queueName: stats.queueName,
      depth: stats.depth,
      oldestMessageAge: stats.oldestMessageAge,
    },
    message,
  );
}

/**
 * Run a DLQ health check for the given queues.
 * Alerts if any queue exceeds the configured threshold.
 *
 * Designed to be called from a CF Worker scheduled handler (cron trigger).
 */
export async function runDlqHealthCheck(
  kv: KVNamespace,
  queueNames: string[],
  config: DlqMonitorConfig,
  logger?: Logger,
): Promise<DlqStats[]> {
  const threshold = config.alertThreshold ?? 10;
  const allStats: DlqStats[] = [];

  for (const queueName of queueNames) {
    const stats = await getDlqStats(kv, queueName);
    allStats.push(stats);

    if (stats.depth >= threshold) {
      await sendDlqAlert(config, stats, logger);
    }
  }

  return allStats;
}

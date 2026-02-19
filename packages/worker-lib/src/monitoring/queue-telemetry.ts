export type QueueMetricStatus = 'received' | 'ack' | 'retry' | 'duplicate' | 'error';

export interface QueueMetricEvent {
  queue: string;
  messageId: string;
  status: QueueMetricStatus;
  eventType?: string;
  durationMs?: number;
  attempt?: number;
  organizationId?: string;
  campaignId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit a structured log entry for queue processing.
 * Cloudflare Workers log aggregation can ship these JSON objects to any sink.
 */
export function logQueueMetric(event: QueueMetricEvent): void {
  console.log({
    event: 'queue.metric',
    ...event,
    timestamp: new Date().toISOString(),
  });
}

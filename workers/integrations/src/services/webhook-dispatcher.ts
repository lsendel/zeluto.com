/**
 * Webhook dispatch engine with HMAC signing, exponential backoff,
 * and automatic disabling after 5 consecutive failures.
 */

// Retry delays in milliseconds: 1min, 5min, 30min, 2hr, 12hr
const RETRY_DELAYS = [
  1 * 60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
];

const MAX_CONSECUTIVE_FAILURES = 5;

export interface WebhookPayload {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  duration?: number;
}

export interface WebhookTarget {
  id: string;
  url: string;
  secret: string;
  consecutiveFailures: number;
}

/**
 * Sign payload with HMAC-SHA256 using the webhook secret.
 * Returns a hex-encoded signature string.
 */
export async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, payloadData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Dispatch a webhook with HMAC signing.
 */
export async function dispatchWebhook(
  target: WebhookTarget,
  payload: WebhookPayload,
): Promise<WebhookDeliveryResult> {
  const body = JSON.stringify(payload);
  const signature = await signPayload(body, target.secret);
  const startTime = Date.now();

  try {
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Id': payload.id,
        'X-Webhook-Event': payload.eventType,
        'X-Webhook-Timestamp': payload.timestamp,
        'User-Agent': 'Mauntic-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 1000),
        duration,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      responseBody: responseBody.slice(0, 1000),
      duration,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

/**
 * Get the retry delay for a given attempt number (0-based).
 * Returns null if no more retries should be attempted.
 */
export function getRetryDelay(attemptNumber: number): number | null {
  if (attemptNumber >= RETRY_DELAYS.length) return null;
  return RETRY_DELAYS[attemptNumber];
}

/**
 * Determine if a webhook endpoint should be auto-disabled
 * after reaching max consecutive failures.
 */
export function shouldDisableEndpoint(consecutiveFailures: number): boolean {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}

/**
 * Queue a webhook delivery for dispatch via the EVENTS queue.
 * Used by route handlers and event consumers to enqueue webhook deliveries.
 */
export async function enqueueWebhookDelivery(
  queue: Queue,
  data: {
    webhookId: string;
    organizationId: string;
    url: string;
    secret: string;
    eventType: string;
    payload: Record<string, unknown>;
    attemptNumber?: number;
  },
): Promise<void> {
  await queue.send({
    type: 'webhook:dispatch',
    webhookId: data.webhookId,
    organizationId: data.organizationId,
    url: data.url,
    secret: data.secret,
    eventType: data.eventType,
    payload: data.payload,
    attemptNumber: data.attemptNumber ?? 0,
    scheduledAt: new Date().toISOString(),
  });
}

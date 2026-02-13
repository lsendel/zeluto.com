import type { DeliveryProvider, EmailPayload, DeliveryResult } from '@mauntic/domain-kernel/delivery';

export interface PostfixProviderConfig {
  mailApiUrl: string;
}

/**
 * PostfixProvider connects to the self-hosted mail infrastructure
 * via the mail-api sidecar running on the Fly.io internal network.
 *
 * Communication is HTTP-based through the sidecar's /api/send endpoint.
 */
export class PostfixProvider implements DeliveryProvider<'email'> {
  readonly channel = 'email' as const;
  readonly name = 'postfix';

  constructor(private config: PostfixProviderConfig) {}

  async send(payload: EmailPayload): Promise<DeliveryResult> {
    try {
      const response = await fetch(`${this.config.mailApiUrl}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          from: payload.from,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          replyTo: payload.replyTo,
          headers: payload.headers,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        messageId?: string;
        error?: string;
      };

      if (response.ok && result.success) {
        return {
          success: true,
          externalId: result.messageId,
        };
      }

      return {
        success: false,
        error: result.error ?? `Postfix sidecar returned status ${response.status}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Postfix send failed: ${message}`,
      };
    }
  }

  /**
   * Check sidecar health to verify connectivity.
   */
  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.mailApiUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

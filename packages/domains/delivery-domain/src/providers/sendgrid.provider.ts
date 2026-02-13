import type { DeliveryProvider, DeliveryResult, EmailPayload } from '@mauntic/domain-kernel';

export interface SendGridProviderConfig {
  apiKey: string;
}

/**
 * SendGrid email provider via HTTP v3 API.
 * Works in both Cloudflare Workers and Node.js (uses fetch).
 */
export class SendGridProvider implements DeliveryProvider<'email'> {
  readonly channel = 'email' as const;
  readonly name = 'sendgrid';

  constructor(private readonly config: SendGridProviderConfig) {}

  async send(payload: EmailPayload): Promise<DeliveryResult> {
    const body = JSON.stringify({
      personalizations: [
        {
          to: [{ email: payload.to }],
        },
      ],
      from: { email: payload.from },
      subject: payload.subject,
      content: [
        ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
        { type: 'text/html', value: payload.html },
      ],
      ...(payload.replyTo ? { reply_to: { email: payload.replyTo } } : {}),
      ...(payload.headers ? { headers: payload.headers } : {}),
    });

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body,
      });

      // SendGrid returns 202 Accepted on success with no body
      if (response.status === 202 || response.status === 200) {
        const messageId = response.headers.get('X-Message-Id') ?? undefined;
        return {
          success: true,
          externalId: messageId,
        };
      }

      const errorText = await response.text();
      return {
        success: false,
        error: `SendGrid API error (${response.status}): ${errorText}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `SendGrid request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}

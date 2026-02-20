import type {
  DeliveryProvider,
  DeliveryResult,
  SmsPayload,
} from '@mauntic/domain-kernel';

export interface TwilioProviderConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Twilio SMS provider via HTTP API.
 * Works in both Cloudflare Workers and Node.js (uses fetch).
 */
export class TwilioProvider implements DeliveryProvider<'sms'> {
  readonly channel = 'sms' as const;
  readonly name = 'twilio';

  constructor(private readonly config: TwilioProviderConfig) {}

  async send(payload: SmsPayload): Promise<DeliveryResult> {
    const { accountSid, authToken, fromNumber } = this.config;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams({
      To: payload.to,
      From: payload.from || fromNumber,
      Body: payload.body,
    });

    const credentials = btoa(`${accountSid}:${authToken}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: formData.toString(),
      });

      const result = (await response.json()) as {
        sid?: string;
        status?: string;
        message?: string;
        code?: number;
      };

      if (response.ok && result.sid) {
        return {
          success: true,
          externalId: result.sid,
        };
      }

      return {
        success: false,
        error: `Twilio API error (${response.status}): ${result.message ?? 'Unknown error'}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Twilio request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}

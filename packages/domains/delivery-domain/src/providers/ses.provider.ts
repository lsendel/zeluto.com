import type {
  DeliveryProvider,
  DeliveryResult,
  EmailPayload,
} from '@mauntic/domain-kernel';

export interface SesProviderConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * AWS SES v2 provider using HTTP API with SigV4 signing.
 * Works in both Cloudflare Workers and Node.js (uses fetch + Web Crypto).
 */
export class SesProvider implements DeliveryProvider<'email'> {
  readonly channel = 'email' as const;
  readonly name = 'ses';

  constructor(private readonly config: SesProviderConfig) {}

  async send(payload: EmailPayload): Promise<DeliveryResult> {
    const { region, accessKeyId, secretAccessKey } = this.config;
    const host = `email.${region}.amazonaws.com`;
    const url = `https://${host}/v2/email/outbound-emails`;

    const body = JSON.stringify({
      Content: {
        Simple: {
          Subject: { Data: payload.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: payload.html, Charset: 'UTF-8' },
            ...(payload.text
              ? { Text: { Data: payload.text, Charset: 'UTF-8' } }
              : {}),
          },
        },
      },
      Destination: {
        ToAddresses: [payload.to],
      },
      FromEmailAddress: payload.from,
      ...(payload.replyTo ? { ReplyToAddresses: [payload.replyTo] } : {}),
    });

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Host: host,
      'X-Amz-Date': amzDate,
    };

    // SigV4 signing
    const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
    const canonicalHeaders = `${Object.entries(headers)
      .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
      .join('\n')}\n`;
    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(';');

    const payloadHash = await sha256Hex(body);

    const canonicalRequest = [
      'POST',
      '/v2/email/outbound-emails',
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(
      secretAccessKey,
      dateStamp,
      region,
      'ses',
    );
    const signature = await hmacHex(signingKey, stringToSign);

    const authorizationHeader =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          Authorization: authorizationHeader,
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `SES API error (${response.status}): ${errorText}`,
        };
      }

      const result = (await response.json()) as { MessageId?: string };
      return {
        success: true,
        externalId: result.MessageId,
      };
    } catch (err) {
      return {
        success: false,
        error: `SES request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SigV4 signing helpers (Web Crypto compatible)
// ---------------------------------------------------------------------------

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hash);
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  message: string,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyBuffer =
    key instanceof Uint8Array ? (key.buffer as ArrayBuffer) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function hmacHex(
  key: ArrayBuffer | Uint8Array,
  message: string,
): Promise<string> {
  const result = await hmac(key, message);
  return arrayBufferToHex(result);
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmac(encoder.encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

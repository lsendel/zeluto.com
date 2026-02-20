import type {
  DeliveryProvider,
  DeliveryResult,
  PushPayload,
} from '@mauntic/domain-kernel';

export interface FcmProviderConfig {
  projectId: string;
  serviceAccountKey: string; // JSON string of the service account key
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

/**
 * Firebase Cloud Messaging (FCM) v1 HTTP API provider.
 * Works in both Cloudflare Workers and Node.js (uses fetch + Web Crypto).
 */
export class FcmProvider implements DeliveryProvider<'push'> {
  readonly channel = 'push' as const;
  readonly name = 'fcm';

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: FcmProviderConfig) {}

  async send(payload: PushPayload): Promise<DeliveryResult> {
    const { projectId } = this.config;
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const token = await this.getAccessToken();

    const body = JSON.stringify({
      message: {
        token: payload.deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        ...(payload.data ? { data: mapDataValues(payload.data) } : {}),
        ...(payload.badge !== undefined
          ? { apns: { payload: { aps: { badge: payload.badge } } } }
          : {}),
      },
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      if (response.ok) {
        const result = (await response.json()) as { name?: string };
        // FCM returns the message name as the ID, e.g. projects/*/messages/*
        const externalId = result.name?.split('/').pop();
        return {
          success: true,
          externalId,
        };
      }

      const errorText = await response.text();
      return {
        success: false,
        error: `FCM API error (${response.status}): ${errorText}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `FCM request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // OAuth2 token management (service account JWT -> access token)
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (this.accessToken && now < this.tokenExpiresAt - 60) {
      return this.accessToken;
    }

    const serviceAccount = JSON.parse(
      this.config.serviceAccountKey,
    ) as ServiceAccountKey;
    const tokenUri =
      serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';

    const jwt = await this.createJwt(serviceAccount, now);

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to get FCM access token: ${err}`);
    }

    const result = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = result.access_token;
    this.tokenExpiresAt = now + result.expires_in;

    return this.accessToken;
  }

  private async createJwt(
    serviceAccount: ServiceAccountKey,
    now: number,
  ): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const privateKey = await importPkcs8Key(serviceAccount.private_key);
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      encoder.encode(signingInput),
    );

    const encodedSignature = base64urlEncodeBuffer(signature);
    return `${signingInput}.${encodedSignature}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** FCM data values must all be strings. */
function mapDataValues(data: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return result;
}

function base64urlEncode(str: string): string {
  const encoder = new TextEncoder();
  return base64urlEncodeBuffer(encoder.encode(str).buffer as ArrayBuffer);
}

function base64urlEncodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function importPkcs8Key(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryString = atob(pemBody);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

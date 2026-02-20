import type { TenantContext } from '@mauntic/domain-kernel/tenant';
import { asOrganizationId, asUserId } from '@mauntic/domain-kernel';
import type { MiddlewareHandler } from 'hono';

export interface ApiKeyData {
  /** The SHA-256 hash of the API key (stored in KV) */
  keyHash: string;
  /** Organization this key belongs to */
  organizationId: string; // UUID
  /** User who created this key */
  userId: string; // UUID
  /** Organization plan (must be 'enterprise') */
  plan: 'enterprise';
  /** User role for RBAC */
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  /** Optional label/name for the key */
  label?: string;
  /** ISO timestamp when the key was created */
  createdAt: string;
  /** ISO timestamp when the key expires (optional) */
  expiresAt?: string;
  /** Rate limit override (requests per minute) */
  rateLimitRpm?: number;
}

export interface ApiKeyMiddlewareConfig {
  /** Default rate limit for API key auth (requests per minute) */
  defaultRateLimitRpm?: number;
}

const DEFAULT_RATE_LIMIT_RPM = 600; // 10 req/s

/**
 * API key authentication middleware for Enterprise plan organizations.
 *
 * Accepts keys via:
 *   - `Authorization: Bearer <api-key>` header
 *   - `X-API-Key: <api-key>` header
 *
 * On valid key:
 *   - Sets tenant context from stored key data
 *   - Sets `apiKeyAuth = true` in context (so CSRF middleware can skip validation)
 *   - Enforces separate rate limiting for API key access
 *
 * On invalid/missing key: passes through to next middleware (session auth fallback).
 * Only Enterprise plan organizations can use API keys.
 */
export function apiKeyMiddleware(
  kv: KVNamespace,
  config?: ApiKeyMiddlewareConfig,
): MiddlewareHandler {
  const rateLimitRpm = config?.defaultRateLimitRpm ?? DEFAULT_RATE_LIMIT_RPM;

  return async (c, next) => {
    const apiKey = extractApiKey(c);

    // No API key provided - fall through to session auth
    if (!apiKey) return next();

    const keyHash = await hashApiKey(apiKey);
    const keyData = await lookupApiKey(kv, keyHash);

    if (!keyData) {
      return c.json({ error: 'INVALID_API_KEY' }, 401);
    }

    // Check expiration
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
      return c.json({ error: 'API_KEY_EXPIRED' }, 401);
    }

    // Enforce Enterprise plan
    if (keyData.plan !== 'enterprise') {
      return c.json(
        {
          error: 'API_KEY_NOT_ALLOWED',
          message:
            'API key authentication is only available for Enterprise plans',
        },
        403,
      );
    }

    // Rate limit check for API key
    const effectiveRpm = keyData.rateLimitRpm ?? rateLimitRpm;
    const rateLimited = await checkApiKeyRateLimit(kv, keyHash, effectiveRpm);

    if (rateLimited) {
      return c.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'API key rate limit exceeded',
          retryAfterSeconds: 60,
        },
        429,
      );
    }

    // Set tenant context from API key data
    const tenantContext: TenantContext = {
      organizationId: asOrganizationId(keyData.organizationId),
      userId: asUserId(keyData.userId),
      userRole: keyData.userRole,
      plan: keyData.plan,
    };

    c.set('tenant', tenantContext);
    c.set('tenantContext', tenantContext);
    c.set('organizationId', keyData.organizationId);
    c.set('userId', keyData.userId);
    c.set('apiKeyAuth', true);

    await next();
  };
}

/**
 * Extract API key from request headers.
 * Checks Authorization: Bearer and X-API-Key headers.
 */
function extractApiKey(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Only treat as API key if it looks like one (starts with 'mk_')
    if (token.startsWith('mk_')) return token;
  }

  return c.req.header('X-API-Key') || undefined;
}

/**
 * Hash an API key using SHA-256 for secure storage comparison.
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Look up API key data from KV by hash.
 * Keys are stored as: `apikey:{hash}` -> JSON(ApiKeyData)
 */
async function lookupApiKey(
  kv: KVNamespace,
  keyHash: string,
): Promise<ApiKeyData | null> {
  const raw = await kv.get(`apikey:${keyHash}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ApiKeyData;
  } catch {
    return null;
  }
}

/**
 * Simple sliding-window rate limiter for API keys using KV.
 * Uses per-minute buckets for simplicity.
 *
 * Returns true if rate limited, false if allowed.
 */
async function checkApiKeyRateLimit(
  kv: KVNamespace,
  keyHash: string,
  maxRpm: number,
): Promise<boolean> {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const rateLimitKey = `apikey-rl:${keyHash}:${minuteBucket}`;

  const current = Number((await kv.get(rateLimitKey)) ?? '0');

  if (current >= maxRpm) return true;

  // Increment counter with 2-minute TTL (current minute + buffer)
  await kv.put(rateLimitKey, String(current + 1), { expirationTtl: 120 });
  return false;
}

/**
 * Utility: store an API key in KV.
 * Call this when provisioning a new API key for an Enterprise org.
 *
 * @param kv - KV namespace
 * @param rawKey - The plaintext API key (returned to user once)
 * @param data - The key metadata to store
 */
export async function storeApiKey(
  kv: KVNamespace,
  rawKey: string,
  data: Omit<ApiKeyData, 'keyHash'>,
): Promise<void> {
  const keyHash = await hashApiKey(rawKey);
  const fullData: ApiKeyData = { ...data, keyHash };
  await kv.put(`apikey:${keyHash}`, JSON.stringify(fullData));
}

/**
 * Utility: revoke an API key from KV.
 */
export async function revokeApiKey(
  kv: KVNamespace,
  rawKey: string,
): Promise<void> {
  const keyHash = await hashApiKey(rawKey);
  await kv.delete(`apikey:${keyHash}`);
}

/**
 * Utility: generate a new API key string.
 * Format: mk_<32 random hex chars>
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mk_${hex}`;
}

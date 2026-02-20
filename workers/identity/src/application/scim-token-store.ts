const SCIM_TOKEN_KV_PREFIX = 'identity:scim:token:';

interface StoredScimToken {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  createdAt: number;
  expiresAt: number | null;
}

export interface IssuedScimToken {
  id: string;
  token: string;
  organizationId: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
}

export type ResolveScimTokenResult =
  | {
      status: 'valid';
      tokenId: string;
      organizationId: string;
    }
  | { status: 'missing' | 'invalid' | 'expired' };

export async function issueScimToken(
  kv: KVNamespace,
  input: {
    organizationId: string;
    name?: string;
    expiresAt?: number | null;
  },
  nowMs: number = Date.now(),
): Promise<IssuedScimToken> {
  const token = `scim_${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
  const tokenHash = await sha256Hex(token);
  const record: StoredScimToken = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    name: normalizeTokenName(input.name),
    isActive: true,
    createdAt: nowMs,
    expiresAt: input.expiresAt ?? null,
  };

  await kv.put(kvKey(tokenHash), JSON.stringify(record));

  return {
    id: record.id,
    token,
    organizationId: record.organizationId,
    name: record.name,
    createdAt: new Date(record.createdAt).toISOString(),
    expiresAt:
      typeof record.expiresAt === 'number'
        ? new Date(record.expiresAt).toISOString()
        : null,
  };
}

export async function resolveScimToken(
  kv: KVNamespace,
  token: string,
  nowMs: number = Date.now(),
): Promise<ResolveScimTokenResult> {
  const normalized = token.trim();
  if (normalized.length === 0) {
    return { status: 'missing' };
  }

  const tokenHash = await sha256Hex(normalized);
  const raw = await kv.get(kvKey(tokenHash));
  if (!raw) {
    return { status: 'missing' };
  }

  let parsed: StoredScimToken | null = null;
  try {
    parsed = JSON.parse(raw) as StoredScimToken;
  } catch {
    await kv.delete(kvKey(tokenHash));
    return { status: 'invalid' };
  }

  if (
    !parsed ||
    typeof parsed.id !== 'string' ||
    parsed.id.length === 0 ||
    typeof parsed.organizationId !== 'string' ||
    parsed.organizationId.length === 0 ||
    parsed.isActive !== true ||
    (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= nowMs)
  ) {
    if (typeof parsed?.expiresAt === 'number' && parsed.expiresAt <= nowMs) {
      await kv.delete(kvKey(tokenHash));
      return { status: 'expired' };
    }
    return { status: 'invalid' };
  }

  return {
    status: 'valid',
    tokenId: parsed.id,
    organizationId: parsed.organizationId,
  };
}

function normalizeTokenName(name?: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'SCIM Token';
  return trimmed.slice(0, 120);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function kvKey(tokenHash: string): string {
  return `${SCIM_TOKEN_KV_PREFIX}${tokenHash}`;
}

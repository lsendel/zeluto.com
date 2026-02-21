const SCIM_TOKEN_KV_PREFIX = 'identity:scim:token:';
const SCIM_TOKEN_ID_KV_PREFIX = 'identity:scim:token-id:';
const SCIM_TOKEN_ORG_INDEX_PREFIX = 'identity:scim:token-index:';

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

export interface ScimTokenMetadata {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
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
  await kv.put(tokenIdKey(record.id), tokenHash);
  await addTokenToOrganizationIndex(kv, record.organizationId, record.id);

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

export async function listScimTokenMetadata(
  kv: KVNamespace,
  organizationId: string,
): Promise<ScimTokenMetadata[]> {
  const tokenIds = await readOrganizationTokenIndex(kv, organizationId);
  const records = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const hash = await kv.get(tokenIdKey(tokenId));
      if (!hash) return null;
      const raw = await kv.get(kvKey(hash));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredScimToken;
      } catch {
        return null;
      }
    }),
  );

  return records
    .filter(
      (record): record is StoredScimToken =>
        !!record && record.organizationId === organizationId,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((record) => ({
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      isActive: record.isActive,
      createdAt: new Date(record.createdAt).toISOString(),
      expiresAt:
        typeof record.expiresAt === 'number'
          ? new Date(record.expiresAt).toISOString()
          : null,
    }));
}

export async function revokeScimTokenById(
  kv: KVNamespace,
  organizationId: string,
  tokenId: string,
): Promise<boolean> {
  const hash = await kv.get(tokenIdKey(tokenId));
  if (!hash) return false;

  const raw = await kv.get(kvKey(hash));
  if (!raw) return false;

  let parsed: StoredScimToken | null = null;
  try {
    parsed = JSON.parse(raw) as StoredScimToken;
  } catch {
    return false;
  }

  if (!parsed || parsed.organizationId !== organizationId) {
    return false;
  }

  if (!parsed.isActive) {
    return true;
  }

  await kv.put(
    kvKey(hash),
    JSON.stringify({
      ...parsed,
      isActive: false,
    }),
  );
  return true;
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

function tokenIdKey(tokenId: string): string {
  return `${SCIM_TOKEN_ID_KV_PREFIX}${tokenId}`;
}

function organizationTokenIndexKey(organizationId: string): string {
  return `${SCIM_TOKEN_ORG_INDEX_PREFIX}${organizationId}`;
}

async function addTokenToOrganizationIndex(
  kv: KVNamespace,
  organizationId: string,
  tokenId: string,
) {
  const index = await readOrganizationTokenIndex(kv, organizationId);
  if (!index.includes(tokenId)) {
    index.push(tokenId);
    await kv.put(
      organizationTokenIndexKey(organizationId),
      JSON.stringify(index),
    );
  }
}

async function readOrganizationTokenIndex(
  kv: KVNamespace,
  organizationId: string,
): Promise<string[]> {
  const raw = await kv.get(organizationTokenIndexKey(organizationId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

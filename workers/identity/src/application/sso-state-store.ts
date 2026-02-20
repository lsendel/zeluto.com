const SSO_STATE_KV_PREFIX = 'identity:sso:state:';
const SSO_STATE_KV_BUFFER_SECONDS = 60;
export const SSO_STATE_TTL_SECONDS = 10 * 60;

export type SsoStateType = 'oidc' | 'saml';

interface StoredSsoState {
  state: string;
  type: SsoStateType;
  connectionId: string;
  nonce: string;
  expiresAt: number;
}

export type ConsumedSsoState =
  | {
      status: 'valid';
      connectionId: string;
      nonce: string;
    }
  | { status: 'missing' | 'invalid' | 'expired' };

export async function issueSsoState(
  kv: KVNamespace,
  input: {
    state: string;
    type: SsoStateType;
    connectionId: string;
    nonce: string;
    ttlSeconds?: number;
  },
  nowMs: number = Date.now(),
): Promise<void> {
  const ttlSeconds = input.ttlSeconds ?? SSO_STATE_TTL_SECONDS;
  const payload: StoredSsoState = {
    state: input.state,
    type: input.type,
    connectionId: input.connectionId,
    nonce: input.nonce,
    expiresAt: nowMs + ttlSeconds * 1000,
  };

  await kv.put(kvKey(input.state), JSON.stringify(payload), {
    // Keep key alive slightly longer so callback can return deterministic
    // "expired" responses even near KV expiration boundaries.
    expirationTtl: ttlSeconds + SSO_STATE_KV_BUFFER_SECONDS,
  });
}

export async function consumeSsoState(
  kv: KVNamespace,
  state: string,
  expectedType: SsoStateType,
  nowMs: number = Date.now(),
): Promise<ConsumedSsoState> {
  const raw = await kv.get(kvKey(state));
  if (!raw) {
    return { status: 'missing' };
  }

  let parsed: StoredSsoState | null = null;
  try {
    parsed = JSON.parse(raw) as StoredSsoState;
  } catch {
    await kv.delete(kvKey(state));
    return { status: 'invalid' };
  }

  if (
    !parsed ||
    parsed.state !== state ||
    parsed.type !== expectedType ||
    typeof parsed.connectionId !== 'string' ||
    parsed.connectionId.length === 0 ||
    typeof parsed.nonce !== 'string' ||
    parsed.nonce.length === 0 ||
    typeof parsed.expiresAt !== 'number' ||
    !Number.isFinite(parsed.expiresAt) ||
    parsed.connectionId !== parseConnectionIdFromState(state)
  ) {
    await kv.delete(kvKey(state));
    return { status: 'invalid' };
  }

  if (parsed.expiresAt <= nowMs) {
    await kv.delete(kvKey(state));
    return { status: 'expired' };
  }

  await kv.delete(kvKey(state));
  return {
    status: 'valid',
    connectionId: parsed.connectionId,
    nonce: parsed.nonce,
  };
}

export function parseConnectionIdFromState(state: string): string | null {
  const trimmed = state.trim();
  if (trimmed.length === 0) return null;
  const [connectionId] = trimmed.split(':');
  if (!connectionId || connectionId.length === 0) return null;
  return connectionId;
}

function kvKey(state: string): string {
  return `${SSO_STATE_KV_PREFIX}${state}`;
}

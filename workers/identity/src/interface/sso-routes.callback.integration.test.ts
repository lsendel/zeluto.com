import { exchangeOidcCode, parseSamlResponse } from '@mauntic/identity-domain';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  issueSsoState,
  SSO_STATE_TTL_SECONDS,
} from '../application/sso-state-store.js';
import type { Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import {
  findEnabledSsoByDomain,
  findEnabledSsoById,
} from '../infrastructure/repositories/drizzle-sso-repository.js';
import { ssoRoutes } from './sso-routes.js';

vi.mock('@mauntic/identity-domain', async () => {
  const actual = await vi.importActual<
    typeof import('@mauntic/identity-domain')
  >('@mauntic/identity-domain');
  return {
    ...actual,
    exchangeOidcCode: vi.fn(),
    parseSamlResponse: vi.fn(),
  };
});

vi.mock('../infrastructure/database.js', () => ({
  createDatabase: vi.fn(),
}));

vi.mock('../infrastructure/repositories/drizzle-sso-repository.js', () => ({
  createSsoConnection: vi.fn(),
  deleteSsoConnection: vi.fn(),
  findEnabledSsoByDomain: vi.fn(),
  findEnabledSsoById: vi.fn(),
  findSsoConnectionById: vi.fn(),
  findSsoConnectionsByOrg: vi.fn(),
  updateSsoConnection: vi.fn(),
}));

function createSsoApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/', ssoRoutes);
  return app;
}

function createMockKv(now: () => number): KVNamespace {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView,
      options?: KVNamespacePutOptions,
    ) {
      const ttl = options?.expirationTtl;
      const expiresAt =
        typeof ttl === 'number' ? now() + ttl * 1000 : Number.POSITIVE_INFINITY;
      store.set(key, {
        value: typeof value === 'string' ? value : String(value),
        expiresAt,
      });
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as KVNamespace;
}

function baseEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {} as Hyperdrive,
    DATABASE_URL: 'postgres://db',
    KV: createMockKv(() => Date.now()),
    BETTER_AUTH_SECRET: 'secret',
    BETTER_AUTH_URL: 'https://app.zeluto.test',
    APP_DOMAIN: 'zeluto.test',
    ...overrides,
  };
}

describe('sso callback routes', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(createDatabase).mockReturnValue({} as never);
  });

  it('returns authenticated payload for OIDC callback using state-bound connection', async () => {
    const kv = createMockKv(() => Date.now());
    await issueSsoState(kv, {
      state: 'conn-oidc-1:nonce-1',
      type: 'oidc',
      connectionId: 'conn-oidc-1',
      nonce: 'nonce-1',
    });

    vi.mocked(findEnabledSsoById).mockResolvedValue({
      id: 'conn-oidc-1',
      organizationId: 'org-1',
      type: 'oidc',
      displayName: 'Okta',
      emailDomain: 'acme.com',
      isEnabled: true,
      samlEntityId: null,
      samlSsoUrl: null,
      samlCertificate: null,
      samlAcsUrl: null,
      oidcIssuer: 'https://acme.okta.com',
      oidcClientId: 'client-id',
      oidcClientSecret: 'client-secret',
      oidcAuthorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
      oidcTokenUrl: 'https://acme.okta.com/oauth2/v1/token',
      oidcUserInfoUrl: 'https://acme.okta.com/oauth2/v1/userinfo',
      oidcScopes: 'openid email profile',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findEnabledSsoById>>);
    vi.mocked(exchangeOidcCode).mockResolvedValue({
      email: 'user@acme.com',
      name: 'Acme User',
      externalId: 'oidc-sub-1',
      provider: 'https://acme.okta.com',
    });

    const app = createSsoApp();
    const response = await app.request(
      'http://localhost/api/auth/sso/callback/oidc?code=auth-code-1&state=conn-oidc-1:nonce-1',
      undefined,
      baseEnv({ KV: kv }),
    );

    expect(response.status).toBe(200);
    expect(findEnabledSsoById).toHaveBeenCalledWith({}, 'conn-oidc-1');
    expect(exchangeOidcCode).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: 'https://acme.okta.com',
        clientId: 'client-id',
      }),
      'auth-code-1',
      'https://app.zeluto.test/api/auth/sso/callback/oidc',
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        status: 'authenticated',
        type: 'oidc',
        organizationId: 'org-1',
        connectionId: 'conn-oidc-1',
        profile: {
          email: 'user@acme.com',
          name: 'Acme User',
          externalId: 'oidc-sub-1',
          provider: 'https://acme.okta.com',
        },
      }),
    );
  });

  it('rejects OIDC callback replay after first successful consumption', async () => {
    const kv = createMockKv(() => Date.now());
    await issueSsoState(kv, {
      state: 'conn-oidc-replay:nonce-r',
      type: 'oidc',
      connectionId: 'conn-oidc-replay',
      nonce: 'nonce-r',
    });

    vi.mocked(findEnabledSsoById).mockResolvedValue({
      id: 'conn-oidc-replay',
      organizationId: 'org-1',
      type: 'oidc',
      displayName: 'Okta',
      emailDomain: 'acme.com',
      isEnabled: true,
      samlEntityId: null,
      samlSsoUrl: null,
      samlCertificate: null,
      samlAcsUrl: null,
      oidcIssuer: 'https://acme.okta.com',
      oidcClientId: 'client-id',
      oidcClientSecret: 'client-secret',
      oidcAuthorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
      oidcTokenUrl: 'https://acme.okta.com/oauth2/v1/token',
      oidcUserInfoUrl: null,
      oidcScopes: 'openid email profile',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findEnabledSsoById>>);
    vi.mocked(exchangeOidcCode).mockResolvedValue({
      email: 'user@acme.com',
      externalId: 'oidc-sub-replay',
      provider: 'https://acme.okta.com',
    });

    const app = createSsoApp();
    const first = await app.request(
      'http://localhost/api/auth/sso/callback/oidc?code=auth-code-r1&state=conn-oidc-replay:nonce-r',
      undefined,
      baseEnv({ KV: kv }),
    );
    const second = await app.request(
      'http://localhost/api/auth/sso/callback/oidc?code=auth-code-r2&state=conn-oidc-replay:nonce-r',
      undefined,
      baseEnv({ KV: kv }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    await expect(second.json()).resolves.toEqual({
      code: 'SSO_STATE_INVALID',
      message: 'SSO callback state is invalid. Please restart sign-in.',
    });
  });

  it('returns expired-state error for OIDC callback after ttl window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-20T00:00:00.000Z'));

    const kv = createMockKv(() => Date.now());
    await issueSsoState(kv, {
      state: 'conn-oidc-expired:nonce-e',
      type: 'oidc',
      connectionId: 'conn-oidc-expired',
      nonce: 'nonce-e',
    });

    vi.setSystemTime(new Date(Date.now() + (SSO_STATE_TTL_SECONDS + 1) * 1000));

    const app = createSsoApp();
    const response = await app.request(
      'http://localhost/api/auth/sso/callback/oidc?code=auth-code-expired&state=conn-oidc-expired:nonce-e',
      undefined,
      baseEnv({ KV: kv }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'SSO_STATE_EXPIRED',
      message: 'SSO callback state expired. Please restart sign-in.',
    });
    expect(findEnabledSsoById).not.toHaveBeenCalled();
  });

  it('rejects OIDC callback when profile email domain does not match connection domain', async () => {
    const kv = createMockKv(() => Date.now());
    await issueSsoState(kv, {
      state: 'conn-oidc-2:nonce-2',
      type: 'oidc',
      connectionId: 'conn-oidc-2',
      nonce: 'nonce-2',
    });

    vi.mocked(findEnabledSsoById).mockResolvedValue({
      id: 'conn-oidc-2',
      organizationId: 'org-1',
      type: 'oidc',
      displayName: 'Okta',
      emailDomain: 'acme.com',
      isEnabled: true,
      samlEntityId: null,
      samlSsoUrl: null,
      samlCertificate: null,
      samlAcsUrl: null,
      oidcIssuer: 'https://acme.okta.com',
      oidcClientId: 'client-id',
      oidcClientSecret: 'client-secret',
      oidcAuthorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
      oidcTokenUrl: 'https://acme.okta.com/oauth2/v1/token',
      oidcUserInfoUrl: null,
      oidcScopes: 'openid email profile',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findEnabledSsoById>>);
    vi.mocked(exchangeOidcCode).mockResolvedValue({
      email: 'user@other.com',
      externalId: 'oidc-sub-2',
      provider: 'https://acme.okta.com',
    });

    const app = createSsoApp();
    const response = await app.request(
      'http://localhost/api/auth/sso/callback/oidc?code=auth-code-2&state=conn-oidc-2:nonce-2',
      undefined,
      baseEnv({ KV: kv }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'FORBIDDEN',
      message: 'SSO account does not match configured email domain',
    });
  });

  it('returns authenticated payload for SAML callback using relayState-bound connection', async () => {
    const kv = createMockKv(() => Date.now());
    await issueSsoState(kv, {
      state: 'conn-saml-1:req-1',
      type: 'saml',
      connectionId: 'conn-saml-1',
      nonce: 'req-1',
    });

    vi.mocked(findEnabledSsoById).mockResolvedValue({
      id: 'conn-saml-1',
      organizationId: 'org-1',
      type: 'saml',
      displayName: 'Azure AD',
      emailDomain: 'acme.com',
      isEnabled: true,
      samlEntityId: 'urn:acme:saml',
      samlSsoUrl: 'https://login.microsoftonline.com/saml2',
      samlCertificate: '-----BEGIN CERTIFICATE-----',
      samlAcsUrl: null,
      oidcIssuer: null,
      oidcClientId: null,
      oidcClientSecret: null,
      oidcAuthorizationUrl: null,
      oidcTokenUrl: null,
      oidcUserInfoUrl: null,
      oidcScopes: null,
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findEnabledSsoById>>);
    vi.mocked(parseSamlResponse).mockReturnValue({
      email: 'person@acme.com',
      name: 'Person Name',
      externalId: 'person@acme.com',
      provider: 'saml',
    });

    const app = createSsoApp();
    const body = new URLSearchParams({
      SAMLResponse: 'base64-response',
      RelayState: 'conn-saml-1:req-1',
    });
    const response = await app.request(
      'http://localhost/api/auth/sso/callback/saml',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
      baseEnv({ KV: kv }),
    );

    expect(response.status).toBe(200);
    expect(parseSamlResponse).toHaveBeenCalledWith(
      'base64-response',
      expect.objectContaining({
        entityId: 'urn:acme:saml',
        ssoUrl: 'https://login.microsoftonline.com/saml2',
      }),
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        status: 'authenticated',
        type: 'saml',
        organizationId: 'org-1',
        connectionId: 'conn-saml-1',
        relayState: 'conn-saml-1:req-1',
      }),
    );
  });

  it('returns invalid assertion error for malformed SAML response', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const kv = createMockKv(() => Date.now());
    await issueSsoState(kv, {
      state: 'conn-saml-2:req-2',
      type: 'saml',
      connectionId: 'conn-saml-2',
      nonce: 'req-2',
    });

    vi.mocked(findEnabledSsoById).mockResolvedValue({
      id: 'conn-saml-2',
      organizationId: 'org-1',
      type: 'saml',
      displayName: 'Azure AD',
      emailDomain: 'acme.com',
      isEnabled: true,
      samlEntityId: 'urn:acme:saml',
      samlSsoUrl: 'https://login.microsoftonline.com/saml2',
      samlCertificate: '-----BEGIN CERTIFICATE-----',
      samlAcsUrl: null,
      oidcIssuer: null,
      oidcClientId: null,
      oidcClientSecret: null,
      oidcAuthorizationUrl: null,
      oidcTokenUrl: null,
      oidcUserInfoUrl: null,
      oidcScopes: null,
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findEnabledSsoById>>);
    vi.mocked(parseSamlResponse).mockImplementation(() => {
      throw new Error('invalid');
    });

    const app = createSsoApp();
    const body = new URLSearchParams({
      SAMLResponse: 'bad-response',
      RelayState: 'conn-saml-2:req-2',
    });
    const response = await app.request(
      'http://localhost/api/auth/sso/callback/saml',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
      baseEnv({ KV: kv }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'SAML_ASSERTION_INVALID',
      message: 'Failed to parse SAML assertion',
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('rejects SAML callback when RelayState is missing', async () => {
    const app = createSsoApp();
    const body = new URLSearchParams({
      SAMLResponse: 'base64-response',
    });
    const response = await app.request(
      'http://localhost/api/auth/sso/callback/saml',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
      baseEnv(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Missing RelayState',
    });
  });

  it('binds init state to connection id for callback correlation', async () => {
    const kv = createMockKv(() => Date.now());
    vi.mocked(findEnabledSsoByDomain).mockResolvedValue({
      id: 'conn-oidc-init',
      organizationId: 'org-1',
      type: 'oidc',
      displayName: 'Okta',
      emailDomain: 'acme.com',
      isEnabled: true,
      samlEntityId: null,
      samlSsoUrl: null,
      samlCertificate: null,
      samlAcsUrl: null,
      oidcIssuer: 'https://acme.okta.com',
      oidcClientId: 'client-id',
      oidcClientSecret: 'client-secret',
      oidcAuthorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
      oidcTokenUrl: 'https://acme.okta.com/oauth2/v1/token',
      oidcUserInfoUrl: null,
      oidcScopes: 'openid email profile',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findEnabledSsoByDomain>>);

    const app = createSsoApp();
    const response = await app.request(
      'http://localhost/api/auth/sso/init?email=alice@acme.com',
      undefined,
      baseEnv({ KV: kv }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json<{
      state: string;
      connectionId: string;
    }>();
    expect(payload.connectionId).toBe('conn-oidc-init');
    expect(payload.state.startsWith('conn-oidc-init:')).toBe(true);
  });
});

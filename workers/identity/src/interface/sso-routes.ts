import {
  buildOidcAuthorizeUrl,
  buildSamlAuthorizeUrl,
  exchangeOidcCode,
  parseSamlResponse,
} from '@mauntic/identity-domain';
import { Hono } from 'hono';
import type { DrizzleDb, Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import {
  createSsoConnection,
  deleteSsoConnection,
  findEnabledSsoByDomain,
  findEnabledSsoById,
  findSsoConnectionsByOrg,
  updateSsoConnection,
} from '../infrastructure/repositories/drizzle-sso-repository.js';

type SsoEnv = {
  Bindings: Env;
  Variables: {
    tenant: { organizationId: string; userId: string };
    db: DrizzleDb;
  };
};

export const ssoRoutes = new Hono<SsoEnv>();

// --- Admin CRUD (requires tenant context) ---

// GET /api/v1/identity/sso - List SSO connections for org
ssoRoutes.get('/api/v1/identity/sso', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const connections = await findSsoConnectionsByOrg(
      db,
      tenant.organizationId,
    );
    // Redact secrets in response
    const safe = connections.map((conn) => ({
      ...conn,
      oidcClientSecret: conn.oidcClientSecret ? '••••••••' : null,
      samlCertificate: conn.samlCertificate ? '[configured]' : null,
    }));
    return c.json({ data: safe });
  } catch (error) {
    console.error('List SSO connections error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list SSO connections' },
      500,
    );
  }
});

// POST /api/v1/identity/sso - Create SSO connection
ssoRoutes.post('/api/v1/identity/sso', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      type: 'saml' | 'oidc';
      displayName: string;
      emailDomain: string;
      // SAML fields
      samlEntityId?: string;
      samlSsoUrl?: string;
      samlCertificate?: string;
      samlAcsUrl?: string;
      // OIDC fields
      oidcIssuer?: string;
      oidcClientId?: string;
      oidcClientSecret?: string;
      oidcAuthorizationUrl?: string;
      oidcTokenUrl?: string;
      oidcUserInfoUrl?: string;
      oidcScopes?: string;
    }>();

    if (!body.type || !body.displayName || !body.emailDomain) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'type, displayName, and emailDomain are required',
        },
        400,
      );
    }

    if (body.type === 'saml') {
      if (!body.samlEntityId || !body.samlSsoUrl || !body.samlCertificate) {
        return c.json(
          {
            code: 'VALIDATION_ERROR',
            message:
              'SAML connections require samlEntityId, samlSsoUrl, and samlCertificate',
          },
          400,
        );
      }
    } else if (body.type === 'oidc') {
      if (
        !body.oidcIssuer ||
        !body.oidcClientId ||
        !body.oidcClientSecret ||
        !body.oidcAuthorizationUrl ||
        !body.oidcTokenUrl
      ) {
        return c.json(
          {
            code: 'VALIDATION_ERROR',
            message:
              'OIDC connections require oidcIssuer, oidcClientId, oidcClientSecret, oidcAuthorizationUrl, and oidcTokenUrl',
          },
          400,
        );
      }
    }

    const connection = await createSsoConnection(db, {
      organizationId: tenant.organizationId,
      type: body.type,
      displayName: body.displayName,
      emailDomain: body.emailDomain.toLowerCase(),
      isEnabled: false,
      samlEntityId: body.samlEntityId ?? null,
      samlSsoUrl: body.samlSsoUrl ?? null,
      samlCertificate: body.samlCertificate ?? null,
      samlAcsUrl: body.samlAcsUrl ?? null,
      oidcIssuer: body.oidcIssuer ?? null,
      oidcClientId: body.oidcClientId ?? null,
      oidcClientSecret: body.oidcClientSecret ?? null,
      oidcAuthorizationUrl: body.oidcAuthorizationUrl ?? null,
      oidcTokenUrl: body.oidcTokenUrl ?? null,
      oidcUserInfoUrl: body.oidcUserInfoUrl ?? null,
      oidcScopes: body.oidcScopes ?? null,
    });

    return c.json(connection, 201);
  } catch (error) {
    console.error('Create SSO connection error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create SSO connection' },
      500,
    );
  }
});

// PATCH /api/v1/identity/sso/:id - Update SSO connection
ssoRoutes.patch('/api/v1/identity/sso/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<Record<string, unknown>>();
    const allowed = [
      'displayName',
      'emailDomain',
      'isEnabled',
      'samlEntityId',
      'samlSsoUrl',
      'samlCertificate',
      'samlAcsUrl',
      'oidcIssuer',
      'oidcClientId',
      'oidcClientSecret',
      'oidcAuthorizationUrl',
      'oidcTokenUrl',
      'oidcUserInfoUrl',
      'oidcScopes',
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    const connection = await updateSsoConnection(
      db,
      tenant.organizationId,
      id,
      updateData,
    );
    if (!connection) {
      return c.json(
        { code: 'NOT_FOUND', message: 'SSO connection not found' },
        404,
      );
    }

    return c.json(connection);
  } catch (error) {
    console.error('Update SSO connection error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update SSO connection' },
      500,
    );
  }
});

// DELETE /api/v1/identity/sso/:id - Delete SSO connection
ssoRoutes.delete('/api/v1/identity/sso/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteSsoConnection(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json(
        { code: 'NOT_FOUND', message: 'SSO connection not found' },
        404,
      );
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete SSO connection error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete SSO connection' },
      500,
    );
  }
});

// --- Public SSO Login Flow (no tenant context) ---

// GET /api/auth/sso/init?email=user@acme.com - Start SSO login
ssoRoutes.get('/api/auth/sso/init', async (c) => {
  const email = c.req.query('email');
  if (!email || !email.includes('@')) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Valid email is required' },
      400,
    );
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Valid email is required' },
      400,
    );
  }
  const db = createDatabase(c.env);
  const connection = await findEnabledSsoByDomain(db, domain);

  if (!connection) {
    return c.json({
      ssoAvailable: false,
      message: 'No SSO configured for this email domain',
    });
  }

  const nonce = crypto.randomUUID();
  const state = `${connection.id}:${nonce}`;
  const baseUrl = c.env.BETTER_AUTH_URL ?? 'https://zeluto.com';

  if (
    connection.type === 'oidc' &&
    connection.oidcIssuer &&
    connection.oidcClientId &&
    connection.oidcClientSecret &&
    connection.oidcAuthorizationUrl &&
    connection.oidcTokenUrl
  ) {
    const redirectUri = `${baseUrl}/api/auth/sso/callback/oidc`;
    const authorizeUrl = buildOidcAuthorizeUrl(
      {
        issuer: connection.oidcIssuer,
        clientId: connection.oidcClientId,
        clientSecret: connection.oidcClientSecret,
        authorizationUrl: connection.oidcAuthorizationUrl,
        tokenUrl: connection.oidcTokenUrl,
        userInfoUrl: connection.oidcUserInfoUrl ?? undefined,
        scopes: connection.oidcScopes ?? 'openid email profile',
      },
      redirectUri,
      state,
      crypto.randomUUID(),
    );

    return c.json({
      ssoAvailable: true,
      type: 'oidc',
      redirectUrl: authorizeUrl,
      state,
      connectionId: connection.id,
    });
  }

  if (
    connection.type === 'saml' &&
    connection.samlEntityId &&
    connection.samlSsoUrl &&
    connection.samlCertificate
  ) {
    const callbackUrl = `${baseUrl}/api/auth/sso/callback/saml`;
    const requestId = crypto.randomUUID();
    const relayState = `${connection.id}:${requestId}`;
    const authorizeUrl = buildSamlAuthorizeUrl(
      {
        entityId: connection.samlEntityId,
        ssoUrl: connection.samlSsoUrl,
        certificate: connection.samlCertificate,
        acsUrl: connection.samlAcsUrl ?? callbackUrl,
      },
      callbackUrl,
      relayState,
    );

    return c.json({
      ssoAvailable: true,
      type: 'saml',
      redirectUrl: authorizeUrl,
      state: relayState,
      connectionId: connection.id,
    });
  }

  return c.json(
    { code: 'SSO_MISCONFIGURED', message: 'SSO connection is incomplete' },
    500,
  );
});

// GET /api/auth/sso/callback/oidc?code=...&state=... - OIDC callback
ssoRoutes.get('/api/auth/sso/callback/oidc', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const explicitConnectionId = c.req.query('connectionId');

  if (!code || !state) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Missing code or state' },
      400,
    );
  }

  const parsedStateConnectionId = parseConnectionIdFromState(state);
  const connectionId = explicitConnectionId ?? parsedStateConnectionId;
  if (!connectionId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Missing SSO connection identifier',
      },
      400,
    );
  }

  const db = createDatabase(c.env);
  const connection = await findEnabledSsoById(db, connectionId);
  if (!connection) {
    return c.json(
      { code: 'NOT_FOUND', message: 'SSO connection not found or disabled' },
      404,
    );
  }
  if (connection.type !== 'oidc') {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Connection is not configured for OIDC',
      },
      400,
    );
  }
  if (
    !connection.oidcIssuer ||
    !connection.oidcClientId ||
    !connection.oidcClientSecret ||
    !connection.oidcAuthorizationUrl ||
    !connection.oidcTokenUrl
  ) {
    return c.json(
      { code: 'SSO_MISCONFIGURED', message: 'OIDC connection is incomplete' },
      500,
    );
  }

  const redirectUri = `${c.env.BETTER_AUTH_URL ?? 'https://zeluto.com'}/api/auth/sso/callback/oidc`;

  try {
    const profile = await exchangeOidcCode(
      {
        issuer: connection.oidcIssuer,
        clientId: connection.oidcClientId,
        clientSecret: connection.oidcClientSecret,
        authorizationUrl: connection.oidcAuthorizationUrl,
        tokenUrl: connection.oidcTokenUrl,
        userInfoUrl: connection.oidcUserInfoUrl ?? undefined,
        scopes: connection.oidcScopes ?? 'openid email profile',
      },
      code,
      redirectUri,
    );

    if (!isEmailInDomain(profile.email, connection.emailDomain)) {
      return c.json(
        {
          code: 'FORBIDDEN',
          message: 'SSO account does not match configured email domain',
        },
        403,
      );
    }

    return c.json({
      status: 'authenticated',
      type: 'oidc',
      organizationId: connection.organizationId,
      connectionId: connection.id,
      profile: {
        email: profile.email,
        name: profile.name ?? null,
        externalId: profile.externalId,
        provider: profile.provider,
      },
      nextAction: 'profile_resolved_create-or-link-session',
    });
  } catch (error) {
    console.error('OIDC callback error:', error);
    return c.json(
      {
        code: 'OIDC_EXCHANGE_FAILED',
        message: 'Failed to authenticate with OIDC provider',
      },
      401,
    );
  }
});

// POST /api/auth/sso/callback/saml - SAML callback (POST binding)
ssoRoutes.post('/api/auth/sso/callback/saml', async (c) => {
  const formData = await c.req.parseBody();
  const samlResponse = formData.SAMLResponse;
  const relayState = formData.RelayState;
  const explicitConnectionId = formData.connectionId;

  if (!samlResponse || typeof samlResponse !== 'string') {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Missing SAMLResponse' },
      400,
    );
  }

  const relayStateValue =
    typeof relayState === 'string' ? relayState : undefined;
  const parsedStateConnectionId = relayStateValue
    ? parseConnectionIdFromState(relayStateValue)
    : null;
  const connectionId =
    typeof explicitConnectionId === 'string'
      ? explicitConnectionId
      : parsedStateConnectionId;

  if (!connectionId) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Missing SSO connection identifier',
      },
      400,
    );
  }

  const db = createDatabase(c.env);
  const connection = await findEnabledSsoById(db, connectionId);
  if (!connection) {
    return c.json(
      { code: 'NOT_FOUND', message: 'SSO connection not found or disabled' },
      404,
    );
  }
  if (connection.type !== 'saml') {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Connection is not configured for SAML',
      },
      400,
    );
  }
  if (
    !connection.samlEntityId ||
    !connection.samlSsoUrl ||
    !connection.samlCertificate
  ) {
    return c.json(
      { code: 'SSO_MISCONFIGURED', message: 'SAML connection is incomplete' },
      500,
    );
  }

  try {
    const profile = parseSamlResponse(samlResponse, {
      entityId: connection.samlEntityId,
      ssoUrl: connection.samlSsoUrl,
      certificate: connection.samlCertificate,
      acsUrl:
        connection.samlAcsUrl ??
        `${c.env.BETTER_AUTH_URL ?? 'https://zeluto.com'}/api/auth/sso/callback/saml`,
    });

    if (!isEmailInDomain(profile.email, connection.emailDomain)) {
      return c.json(
        {
          code: 'FORBIDDEN',
          message: 'SSO account does not match configured email domain',
        },
        403,
      );
    }

    return c.json({
      status: 'authenticated',
      type: 'saml',
      organizationId: connection.organizationId,
      connectionId: connection.id,
      profile: {
        email: profile.email,
        name: profile.name ?? null,
        externalId: profile.externalId,
        provider: profile.provider,
      },
      relayState: relayStateValue ?? null,
      nextAction: 'profile_resolved_create-or-link-session',
    });
  } catch (error) {
    console.error('SAML callback error:', error);
    return c.json(
      {
        code: 'SAML_ASSERTION_INVALID',
        message: 'Failed to parse SAML assertion',
      },
      401,
    );
  }
});

function parseConnectionIdFromState(state: string): string | null {
  const trimmed = state.trim();
  if (trimmed.length === 0) return null;
  const [connectionId] = trimmed.split(':');
  if (!connectionId || connectionId.length === 0) return null;
  return connectionId;
}

function isEmailInDomain(email: string, domain: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDomain = domain.trim().toLowerCase();
  return normalizedEmail.endsWith(`@${normalizedDomain}`);
}

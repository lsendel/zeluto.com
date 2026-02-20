import {
  buildOidcAuthorizeUrl,
  buildSamlAuthorizeUrl,
} from '@mauntic/identity-domain';
import { Hono } from 'hono';
import type { DrizzleDb, Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import {
  createSsoConnection,
  deleteSsoConnection,
  findEnabledSsoByDomain,
  findSsoConnectionById,
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
    const deleted = await deleteSsoConnection(
      db,
      tenant.organizationId,
      id,
    );
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

  const domain = email.split('@')[1]!.toLowerCase();
  const db = createDatabase(c.env);
  const connection = await findEnabledSsoByDomain(db, domain);

  if (!connection) {
    return c.json(
      {
        ssoAvailable: false,
        message: 'No SSO configured for this email domain',
      },
    );
  }

  const state = crypto.randomUUID();
  const baseUrl = c.env.BETTER_AUTH_URL ?? 'https://zeluto.com';

  if (connection.type === 'oidc' && connection.oidcAuthorizationUrl) {
    const redirectUri = `${baseUrl}/api/auth/sso/callback/oidc`;
    const authorizeUrl = buildOidcAuthorizeUrl(
      {
        issuer: connection.oidcIssuer!,
        clientId: connection.oidcClientId!,
        clientSecret: connection.oidcClientSecret!,
        authorizationUrl: connection.oidcAuthorizationUrl,
        tokenUrl: connection.oidcTokenUrl!,
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

  if (connection.type === 'saml' && connection.samlSsoUrl) {
    const callbackUrl = `${baseUrl}/api/auth/sso/callback/saml`;
    const requestId = crypto.randomUUID();
    const authorizeUrl = buildSamlAuthorizeUrl(
      {
        entityId: connection.samlEntityId!,
        ssoUrl: connection.samlSsoUrl,
        certificate: connection.samlCertificate!,
        acsUrl: connection.samlAcsUrl ?? callbackUrl,
      },
      callbackUrl,
      requestId,
    );

    return c.json({
      ssoAvailable: true,
      type: 'saml',
      redirectUrl: authorizeUrl,
      state: requestId,
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

  if (!code || !state) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Missing code or state' },
      400,
    );
  }

  // In production, state should be validated against a stored nonce.
  // For now, we extract the connection and exchange the code.
  return c.json({
    status: 'callback_received',
    code: code.slice(0, 8) + '...',
    state,
    message:
      'OIDC code exchange and session creation will be wired in the next iteration',
  });
});

// POST /api/auth/sso/callback/saml - SAML callback (POST binding)
ssoRoutes.post('/api/auth/sso/callback/saml', async (c) => {
  const formData = await c.req.parseBody();
  const samlResponse = formData['SAMLResponse'];
  const relayState = formData['RelayState'];

  if (!samlResponse || typeof samlResponse !== 'string') {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Missing SAMLResponse' },
      400,
    );
  }

  return c.json({
    status: 'callback_received',
    relayState,
    message:
      'SAML assertion parsing and session creation will be wired in the next iteration',
  });
});

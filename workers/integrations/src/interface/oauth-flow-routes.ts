import { OAuthGrant } from '@mauntic/integrations-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findGrantByCode,
  findGrantByRefreshToken,
  findOAuthAppByClientId,
  insertGrant,
  revokeGrantsByApp,
  updateGrant,
} from '../infrastructure/repositories/oauth-app-repository.js';

export const oauthFlowRoutes = new Hono<Env>();

// ── OAuth 2.0 Authorization Code Flow ───────────────────

/**
 * POST /api/v1/integrations/oauth/authorize
 * Creates an authorization grant (authorization code) for an app.
 * Called after user approves the consent screen.
 */
oauthFlowRoutes.post('/api/v1/integrations/oauth/authorize', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      clientId: string;
      redirectUri: string;
      scopes: string[];
      state?: string;
    }>();

    if (!body.clientId || !body.redirectUri) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'clientId and redirectUri are required',
        },
        400,
      );
    }

    // Validate the app exists and is published
    const app = await findOAuthAppByClientId(db, body.clientId);
    if (!app || !app.isPublished) {
      return c.json(
        { code: 'NOT_FOUND', message: 'OAuth app not found or not published' },
        404,
      );
    }

    // Validate redirect URI
    const redirectUris = app.redirectUris as string[];
    if (!redirectUris.includes(body.redirectUri)) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid redirect URI' },
        400,
      );
    }

    // Validate requested scopes are a subset of app's allowed scopes
    const allowedScopes = app.scopes as string[];
    const requestedScopes = body.scopes ?? [];
    const invalidScopes = requestedScopes.filter(
      (s) => !allowedScopes.includes(s),
    );
    if (invalidScopes.length > 0) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: `Invalid scopes: ${invalidScopes.join(', ')}`,
        },
        400,
      );
    }

    // Create authorization grant
    const grant = OAuthGrant.createAuthorizationCode({
      appId: app.id,
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      scopes: requestedScopes.length > 0 ? requestedScopes : allowedScopes,
    });

    const props = grant.toProps();
    await insertGrant(db, {
      id: props.id,
      appId: props.appId,
      organizationId: props.organizationId,
      userId: props.userId,
      code: props.code,
      scopes: props.scopes,
      codeExpiresAt: props.codeExpiresAt,
    });

    // Build redirect URL with authorization code
    const redirectUrl = new URL(body.redirectUri);
    redirectUrl.searchParams.set('code', props.code!);
    if (body.state) redirectUrl.searchParams.set('state', body.state);

    return c.json({
      redirectUrl: redirectUrl.toString(),
      code: props.code,
      expiresAt: props.codeExpiresAt,
    });
  } catch (error) {
    console.error('OAuth authorize error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Authorization failed' },
      500,
    );
  }
});

/**
 * POST /api/v1/integrations/oauth/token
 * Exchange authorization code for access + refresh tokens.
 * Standard OAuth 2.0 token endpoint.
 */
oauthFlowRoutes.post('/api/v1/integrations/oauth/token', async (c) => {
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      grant_type: string;
      code?: string;
      client_id: string;
      client_secret: string;
      redirect_uri?: string;
      refresh_token?: string;
    }>();

    // Validate client credentials
    const app = await findOAuthAppByClientId(db, body.client_id);
    if (!app || app.clientSecret !== body.client_secret) {
      return c.json(
        { error: 'invalid_client', error_description: 'Invalid client credentials' },
        401,
      );
    }

    if (body.grant_type === 'authorization_code') {
      return await handleCodeExchange(db, app, body);
    }

    if (body.grant_type === 'refresh_token') {
      return await handleRefreshToken(db, app, body);
    }

    return c.json(
      {
        error: 'unsupported_grant_type',
        error_description: `Unsupported grant type: ${body.grant_type}`,
      },
      400,
    );
  } catch (error) {
    console.error('OAuth token error:', error);
    return c.json(
      { error: 'server_error', error_description: 'Token exchange failed' },
      500,
    );
  }
});

async function handleCodeExchange(
  db: any,
  app: { id: string; redirectUris: unknown },
  body: {
    code?: string;
    redirect_uri?: string;
  },
) {
  if (!body.code) {
    return Response.json(
      { error: 'invalid_request', error_description: 'code is required' },
      { status: 400 },
    );
  }

  const grantRow = await findGrantByCode(db, body.code);
  if (!grantRow || grantRow.appId !== app.id) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'Invalid authorization code' },
      { status: 400 },
    );
  }

  // Reconstitute and exchange
  const grant = OAuthGrant.reconstitute({
    ...grantRow,
    scopes: grantRow.scopes as string[],
  });

  if (grant.isCodeExpired()) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'Authorization code has expired' },
      { status: 400 },
    );
  }

  const tokens = grant.exchangeCode();
  const props = grant.toProps();

  await updateGrant(db, props.id, {
    code: null,
    accessToken: props.accessToken,
    refreshToken: props.refreshToken,
    accessTokenExpiresAt: props.accessTokenExpiresAt,
    refreshTokenExpiresAt: props.refreshTokenExpiresAt,
  });

  return Response.json({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: (grantRow.scopes as string[]).join(' '),
  });
}

async function handleRefreshToken(
  db: any,
  app: { id: string },
  body: { refresh_token?: string },
) {
  if (!body.refresh_token) {
    return Response.json(
      { error: 'invalid_request', error_description: 'refresh_token is required' },
      { status: 400 },
    );
  }

  const grantRow = await findGrantByRefreshToken(db, body.refresh_token);
  if (!grantRow || grantRow.appId !== app.id) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'Invalid refresh token' },
      { status: 400 },
    );
  }

  const grant = OAuthGrant.reconstitute({
    ...grantRow,
    scopes: grantRow.scopes as string[],
  });

  try {
    const newAccessToken = grant.refreshAccessToken();
    const props = grant.toProps();

    await updateGrant(db, props.id, {
      accessToken: props.accessToken,
      accessTokenExpiresAt: props.accessTokenExpiresAt,
    });

    return Response.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: (grantRow.scopes as string[]).join(' '),
    });
  } catch (err) {
    return Response.json(
      {
        error: 'invalid_grant',
        error_description:
          err instanceof Error ? err.message : 'Refresh failed',
      },
      { status: 400 },
    );
  }
}

/**
 * POST /api/v1/integrations/oauth/revoke
 * Revoke all grants for an app (org-scoped).
 */
oauthFlowRoutes.post('/api/v1/integrations/oauth/revoke', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{ appId: string }>();
    if (!body.appId) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'appId is required' },
        400,
      );
    }

    const count = await revokeGrantsByApp(
      db,
      tenant.organizationId,
      body.appId,
    );
    return c.json({ revoked: count });
  } catch (error) {
    console.error('OAuth revoke error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to revoke grants' },
      500,
    );
  }
});

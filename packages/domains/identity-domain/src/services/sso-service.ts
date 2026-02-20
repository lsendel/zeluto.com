/**
 * SSO authentication service.
 *
 * Handles OIDC authorization code exchange and SAML response validation.
 * Returns a normalized user profile that the caller uses to upsert/link
 * an identity record and create a session.
 */

import type { OidcConfig, SamlConfig } from '../entities/sso-connection.js';

export interface SsoUserProfile {
  email: string;
  name?: string;
  externalId: string; // IdP subject / nameId
  provider: string; // IdP identifier
  rawAttributes?: Record<string, unknown>;
}

export interface OidcTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Build the OIDC authorization redirect URL.
 */
export function buildOidcAuthorizeUrl(
  config: OidcConfig,
  redirectUri: string,
  state: string,
  nonce: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes ?? 'openid email profile',
    state,
    nonce,
  });
  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange an OIDC authorization code for tokens, then fetch the user profile.
 */
export async function exchangeOidcCode(
  config: OidcConfig,
  code: string,
  redirectUri: string,
): Promise<SsoUserProfile> {
  // Token exchange
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => 'unknown');
    throw new Error(
      `OIDC token exchange failed (${tokenResponse.status}): ${errorText}`,
    );
  }

  const tokens = (await tokenResponse.json()) as OidcTokenResponse;

  // Try to extract profile from id_token (JWT) first
  if (tokens.id_token) {
    const profile = parseJwtProfile(tokens.id_token, config.issuer);
    if (profile) return profile;
  }

  // Fall back to userinfo endpoint
  if (config.userInfoUrl) {
    const userinfoResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (userinfoResponse.ok) {
      const userinfo = (await userinfoResponse.json()) as Record<
        string,
        unknown
      >;
      return {
        email: String(userinfo.email ?? ''),
        name: userinfo.name ? String(userinfo.name) : undefined,
        externalId: String(userinfo.sub ?? userinfo.email ?? ''),
        provider: config.issuer,
        rawAttributes: userinfo,
      };
    }
  }

  throw new Error('Failed to retrieve user profile from OIDC provider');
}

/**
 * Parse a JWT id_token (without cryptographic validation — the token
 * was received directly from the IdP over TLS after code exchange).
 */
function parseJwtProfile(
  idToken: string,
  issuer: string,
): SsoUserProfile | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]!)) as Record<string, unknown>;

    const email = payload.email;
    if (typeof email !== 'string' || !email.includes('@')) return null;

    return {
      email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      externalId: String(payload.sub ?? email),
      provider: issuer,
      rawAttributes: payload,
    };
  } catch {
    return null;
  }
}

/**
 * Build a SAML AuthnRequest redirect URL.
 *
 * Generates a minimal SAML 2.0 AuthnRequest using base64 encoding.
 * Full XML signing is deferred to a future iteration.
 */
export function buildSamlAuthorizeUrl(
  config: SamlConfig,
  callbackUrl: string,
  requestId: string,
): string {
  const now = new Date().toISOString();
  const xml = [
    '<samlp:AuthnRequest',
    '  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"',
    '  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"',
    `  ID="_${requestId}"`,
    '  Version="2.0"',
    `  IssueInstant="${now}"`,
    `  AssertionConsumerServiceURL="${callbackUrl}"`,
    '  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">',
    `  <saml:Issuer>${config.acsUrl}</saml:Issuer>`,
    '</samlp:AuthnRequest>',
  ].join('\n');

  const encoded = btoa(xml);
  const params = new URLSearchParams({
    SAMLRequest: encoded,
    RelayState: requestId,
  });

  return `${config.ssoUrl}?${params.toString()}`;
}

/**
 * Parse a SAML Response and extract the user profile.
 *
 * This is a simplified parser that extracts NameID and basic attributes
 * from an unencrypted SAML assertion. Production use should validate
 * the XML signature against the IdP certificate.
 */
export function parseSamlResponse(
  samlResponseB64: string,
  _config: SamlConfig,
): SsoUserProfile {
  const xml = atob(samlResponseB64);

  // Extract NameID
  const nameIdMatch =
    xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) ??
    xml.match(/<NameID[^>]*>([^<]+)<\/NameID>/);

  if (!nameIdMatch?.[1]) {
    throw new Error('SAML response missing NameID');
  }

  const email = nameIdMatch[1].trim();
  if (!email.includes('@')) {
    throw new Error('SAML NameID is not an email address');
  }

  // Extract optional attributes
  const attrs: Record<string, string> = {};
  const attrRegex =
    /<(?:saml:)?Attribute\s+Name="([^"]+)"[^>]*>\s*<(?:saml:)?AttributeValue[^>]*>([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(xml)) !== null) {
    attrs[match[1]!] = match[2]!.trim();
  }

  const name =
    attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ??
    attrs['displayName'] ??
    attrs['cn'] ??
    undefined;

  return {
    email,
    name,
    externalId: email,
    provider: 'saml',
    rawAttributes: attrs,
  };
}

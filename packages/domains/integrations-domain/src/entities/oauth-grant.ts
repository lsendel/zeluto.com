import { z } from 'zod';

export const OAuthGrantPropsSchema = z.object({
  id: z.string().uuid(),
  appId: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  code: z.string().nullable(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  scopes: z.array(z.string()),
  codeExpiresAt: z.coerce.date().nullable(),
  accessTokenExpiresAt: z.coerce.date().nullable(),
  refreshTokenExpiresAt: z.coerce.date().nullable(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type OAuthGrantProps = z.infer<typeof OAuthGrantPropsSchema>;

function generateToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class OAuthGrant {
  private constructor(private props: OAuthGrantProps) {}

  static createAuthorizationCode(input: {
    appId: string;
    organizationId: string;
    userId: string;
    scopes: string[];
    codeLifetimeMs?: number;
  }): OAuthGrant {
    const codeLifetime = input.codeLifetimeMs ?? 10 * 60 * 1000; // 10 minutes
    return new OAuthGrant(
      OAuthGrantPropsSchema.parse({
        id: crypto.randomUUID(),
        appId: input.appId,
        organizationId: input.organizationId,
        userId: input.userId,
        code: generateToken(64),
        accessToken: null,
        refreshToken: null,
        scopes: input.scopes,
        codeExpiresAt: new Date(Date.now() + codeLifetime),
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: OAuthGrantProps): OAuthGrant {
    return new OAuthGrant(OAuthGrantPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get appId() {
    return this.props.appId;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get userId() {
    return this.props.userId;
  }
  get code() {
    return this.props.code;
  }
  get accessToken() {
    return this.props.accessToken;
  }
  get refreshToken() {
    return this.props.refreshToken;
  }
  get scopes() {
    return this.props.scopes;
  }

  isCodeExpired(): boolean {
    if (!this.props.codeExpiresAt) return true;
    return Date.now() > this.props.codeExpiresAt.getTime();
  }

  isAccessTokenExpired(): boolean {
    if (!this.props.accessTokenExpiresAt) return true;
    return Date.now() > this.props.accessTokenExpiresAt.getTime();
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  /**
   * Exchange authorization code for access + refresh tokens.
   * Invalidates the code after exchange.
   */
  exchangeCode(opts?: {
    accessTokenLifetimeMs?: number;
    refreshTokenLifetimeMs?: number;
  }): { accessToken: string; refreshToken: string } {
    if (this.isCodeExpired()) throw new Error('Authorization code has expired');
    if (this.isRevoked()) throw new Error('Grant has been revoked');
    if (this.props.accessToken) throw new Error('Code already exchanged');

    const accessLifetime = opts?.accessTokenLifetimeMs ?? 60 * 60 * 1000; // 1 hour
    const refreshLifetime =
      opts?.refreshTokenLifetimeMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days

    const accessToken = generateToken(64);
    const refreshToken = generateToken(64);

    this.props.accessToken = accessToken;
    this.props.refreshToken = refreshToken;
    this.props.code = null; // Invalidate code
    this.props.accessTokenExpiresAt = new Date(Date.now() + accessLifetime);
    this.props.refreshTokenExpiresAt = new Date(Date.now() + refreshLifetime);

    return { accessToken, refreshToken };
  }

  /**
   * Refresh the access token using a valid refresh token.
   */
  refreshAccessToken(opts?: {
    accessTokenLifetimeMs?: number;
  }): string {
    if (this.isRevoked()) throw new Error('Grant has been revoked');
    if (
      this.props.refreshTokenExpiresAt &&
      Date.now() > this.props.refreshTokenExpiresAt.getTime()
    ) {
      throw new Error('Refresh token has expired');
    }

    const accessLifetime = opts?.accessTokenLifetimeMs ?? 60 * 60 * 1000;
    const newToken = generateToken(64);
    this.props.accessToken = newToken;
    this.props.accessTokenExpiresAt = new Date(Date.now() + accessLifetime);
    return newToken;
  }

  revoke(): void {
    this.props.revokedAt = new Date();
  }

  toProps(): Readonly<OAuthGrantProps> {
    return Object.freeze({ ...this.props });
  }
}

import { z } from 'zod';

export const OAuthAppPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUris: z.array(z.string().url()),
  scopes: z.array(z.string()),
  isPublished: z.boolean(),
  isVerified: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type OAuthAppProps = z.infer<typeof OAuthAppPropsSchema>;

/**
 * Generate a random client ID (32 hex chars).
 */
function generateClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random client secret (64 hex chars).
 */
function generateClientSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class OAuthApp {
  private constructor(private props: OAuthAppProps) {}

  static create(input: {
    organizationId?: string | null;
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    redirectUris: string[];
    scopes: string[];
    createdBy: string;
  }): OAuthApp {
    return new OAuthApp(
      OAuthAppPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId ?? null,
        name: input.name,
        description: input.description ?? null,
        logoUrl: input.logoUrl ?? null,
        clientId: generateClientId(),
        clientSecret: generateClientSecret(),
        redirectUris: input.redirectUris,
        scopes: input.scopes,
        isPublished: false,
        isVerified: false,
        createdBy: input.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: OAuthAppProps): OAuthApp {
    return new OAuthApp(OAuthAppPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get name() {
    return this.props.name;
  }
  get description() {
    return this.props.description;
  }
  get logoUrl() {
    return this.props.logoUrl;
  }
  get clientId() {
    return this.props.clientId;
  }
  get clientSecret() {
    return this.props.clientSecret;
  }
  get redirectUris() {
    return this.props.redirectUris;
  }
  get scopes() {
    return this.props.scopes;
  }
  get isPublished() {
    return this.props.isPublished;
  }
  get isVerified() {
    return this.props.isVerified;
  }

  update(input: {
    name?: string;
    description?: string | null;
    logoUrl?: string | null;
    redirectUris?: string[];
    scopes?: string[];
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.description !== undefined)
      this.props.description = input.description;
    if (input.logoUrl !== undefined) this.props.logoUrl = input.logoUrl;
    if (input.redirectUris !== undefined)
      this.props.redirectUris = input.redirectUris;
    if (input.scopes !== undefined) this.props.scopes = input.scopes;
    this.props.updatedAt = new Date();
  }

  publish(): void {
    this.props.isPublished = true;
    this.props.updatedAt = new Date();
  }

  unpublish(): void {
    this.props.isPublished = false;
    this.props.updatedAt = new Date();
  }

  verify(): void {
    this.props.isVerified = true;
    this.props.updatedAt = new Date();
  }

  rotateSecret(): string {
    const newSecret = generateClientSecret();
    this.props.clientSecret = newSecret;
    this.props.updatedAt = new Date();
    return newSecret;
  }

  validateRedirectUri(uri: string): boolean {
    return this.props.redirectUris.includes(uri);
  }

  toProps(): Readonly<OAuthAppProps> {
    return Object.freeze({ ...this.props });
  }
}

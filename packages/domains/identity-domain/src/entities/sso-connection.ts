import { z } from 'zod';

export const SsoTypeSchema = z.enum(['saml', 'oidc']);
export type SsoType = z.infer<typeof SsoTypeSchema>;

export const SamlConfigSchema = z.object({
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  certificate: z.string().min(1),
  acsUrl: z.string().url(),
});

export const OidcConfigSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  authorizationUrl: z.string().url(),
  tokenUrl: z.string().url(),
  userInfoUrl: z.string().url().optional(),
  scopes: z.string().default('openid email profile'),
});

export type SamlConfig = z.infer<typeof SamlConfigSchema>;
export type OidcConfig = z.infer<typeof OidcConfigSchema>;

export const SsoConnectionPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: SsoTypeSchema,
  displayName: z.string().min(1),
  emailDomain: z.string().min(1),
  isEnabled: z.boolean(),
  saml: SamlConfigSchema.nullable(),
  oidc: OidcConfigSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SsoConnectionProps = z.infer<typeof SsoConnectionPropsSchema>;

export class SsoConnection {
  private constructor(private props: SsoConnectionProps) {}

  static createSaml(input: {
    organizationId: string;
    displayName: string;
    emailDomain: string;
    config: SamlConfig;
  }): SsoConnection {
    return new SsoConnection(
      SsoConnectionPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        type: 'saml',
        displayName: input.displayName,
        emailDomain: input.emailDomain.toLowerCase(),
        isEnabled: false,
        saml: input.config,
        oidc: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static createOidc(input: {
    organizationId: string;
    displayName: string;
    emailDomain: string;
    config: OidcConfig;
  }): SsoConnection {
    return new SsoConnection(
      SsoConnectionPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        type: 'oidc',
        displayName: input.displayName,
        emailDomain: input.emailDomain.toLowerCase(),
        isEnabled: false,
        saml: null,
        oidc: input.config,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SsoConnectionProps): SsoConnection {
    return new SsoConnection(SsoConnectionPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get type() {
    return this.props.type;
  }
  get displayName() {
    return this.props.displayName;
  }
  get emailDomain() {
    return this.props.emailDomain;
  }
  get isEnabled() {
    return this.props.isEnabled;
  }
  get saml() {
    return this.props.saml;
  }
  get oidc() {
    return this.props.oidc;
  }

  enable(): void {
    this.props.isEnabled = true;
    this.props.updatedAt = new Date();
  }

  disable(): void {
    this.props.isEnabled = false;
    this.props.updatedAt = new Date();
  }

  updateDisplayName(name: string): void {
    this.props.displayName = name;
    this.props.updatedAt = new Date();
  }

  updateSamlConfig(config: SamlConfig): void {
    if (this.props.type !== 'saml') {
      throw new Error('Cannot set SAML config on an OIDC connection');
    }
    this.props.saml = SamlConfigSchema.parse(config);
    this.props.updatedAt = new Date();
  }

  updateOidcConfig(config: OidcConfig): void {
    if (this.props.type !== 'oidc') {
      throw new Error('Cannot set OIDC config on a SAML connection');
    }
    this.props.oidc = OidcConfigSchema.parse(config);
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<SsoConnectionProps> {
    return Object.freeze({ ...this.props });
  }
}

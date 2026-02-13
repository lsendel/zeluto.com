import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const ConnectionProviderSchema = z.enum([
  'salesforce',
  'hubspot',
  'segment',
  'posthog',
  'custom',
]);

export type ConnectionProvider = z.infer<typeof ConnectionProviderSchema>;

export const ConnectionStatusSchema = z.enum(['active', 'error', 'disabled']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const ConnectionPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  provider: ConnectionProviderSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
  status: ConnectionStatusSchema,
  lastSyncAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ConnectionProps = z.infer<typeof ConnectionPropsSchema>;

export class Connection {
  private constructor(private props: ConnectionProps) {}

  static create(input: {
    organizationId: string;
    provider: ConnectionProvider;
    name: string;
    config: Record<string, unknown>;
  }): Connection {
    return new Connection(
      ConnectionPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        provider: input.provider,
        name: input.name,
        config: input.config,
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ConnectionProps): Connection {
    return new Connection(ConnectionPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get provider(): ConnectionProvider {
    return this.props.provider;
  }
  get name(): string {
    return this.props.name;
  }
  get config(): Record<string, unknown> {
    return this.props.config;
  }
  get status(): ConnectionStatus {
    return this.props.status;
  }
  get lastSyncAt(): Date | null {
    return this.props.lastSyncAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(input: {
    name?: string;
    config?: Record<string, unknown>;
    status?: ConnectionStatus;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.config !== undefined) this.props.config = input.config;
    if (input.status !== undefined) this.props.status = input.status;
    this.props.updatedAt = new Date();
  }

  markSynced(): void {
    this.props.lastSyncAt = new Date();
    this.props.updatedAt = new Date();
  }

  markError(): void {
    this.props.status = 'error';
    this.props.updatedAt = new Date();
  }

  disable(): void {
    this.props.status = 'disabled';
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<ConnectionProps> {
    return Object.freeze({ ...this.props });
  }
}

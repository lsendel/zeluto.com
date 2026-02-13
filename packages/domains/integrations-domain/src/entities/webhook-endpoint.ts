import { z } from 'zod';

export const WebhookEndpointPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string().min(1),
  isActive: z.boolean(),
  consecutiveFailures: z.number().default(0),
  lastTriggeredAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type WebhookEndpointProps = z.infer<typeof WebhookEndpointPropsSchema>;

const MAX_CONSECUTIVE_FAILURES = 5;

export class WebhookEndpoint {
  private constructor(private props: WebhookEndpointProps) {}

  static create(input: {
    organizationId: string;
    url: string;
    events: string[];
    secret?: string;
  }): WebhookEndpoint {
    return new WebhookEndpoint(
      WebhookEndpointPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        url: input.url,
        events: input.events,
        secret: input.secret ?? crypto.randomUUID(),
        isActive: true,
        consecutiveFailures: 0,
        lastTriggeredAt: null,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: WebhookEndpointProps): WebhookEndpoint {
    return new WebhookEndpoint(WebhookEndpointPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get url(): string {
    return this.props.url;
  }
  get events(): string[] {
    return this.props.events;
  }
  get secret(): string {
    return this.props.secret;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get consecutiveFailures(): number {
    return this.props.consecutiveFailures;
  }
  get lastTriggeredAt(): Date | null {
    return this.props.lastTriggeredAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  update(input: {
    url?: string;
    events?: string[];
    secret?: string;
    isActive?: boolean;
  }): void {
    if (input.url !== undefined) this.props.url = input.url;
    if (input.events !== undefined) this.props.events = input.events;
    if (input.secret !== undefined) this.props.secret = input.secret;
    if (input.isActive !== undefined) this.props.isActive = input.isActive;
  }

  recordSuccess(): void {
    this.props.consecutiveFailures = 0;
    this.props.lastTriggeredAt = new Date();
  }

  recordFailure(): void {
    this.props.consecutiveFailures += 1;
    this.props.lastTriggeredAt = new Date();

    // Auto-disable after MAX_CONSECUTIVE_FAILURES
    if (this.props.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.props.isActive = false;
    }
  }

  isSubscribedTo(eventType: string): boolean {
    return this.props.events.includes(eventType) || this.props.events.includes('*');
  }

  shouldAutoDisable(): boolean {
    return this.props.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
  }

  reactivate(): void {
    this.props.isActive = true;
    this.props.consecutiveFailures = 0;
  }

  toProps(): Readonly<WebhookEndpointProps> {
    return Object.freeze({ ...this.props });
  }
}

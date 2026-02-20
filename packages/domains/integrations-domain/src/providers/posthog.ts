/**
 * PostHog event forwarding adapter.
 * Forwards domain events to PostHog's capture API.
 */

export interface PostHogConfig {
  apiKey: string;
  host?: string; // defaults to https://app.posthog.com
}

export interface PostHogEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export class PostHogAdapter {
  private apiKey: string;
  private host: string;

  constructor(config: PostHogConfig) {
    this.apiKey = config.apiKey;
    this.host = config.host ?? 'https://app.posthog.com';
  }

  static fromConfig(config: Record<string, unknown>): PostHogAdapter {
    return new PostHogAdapter({
      apiKey: config.apiKey as string,
      host: config.host as string | undefined,
    });
  }

  async capture(
    event: PostHogEvent,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          event: event.event,
          distinct_id: event.distinctId,
          properties: {
            ...event.properties,
            $lib: 'mauntic',
          },
          timestamp: event.timestamp ?? new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          error: `PostHog returned ${response.status}: ${body}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `PostHog request failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async forwardDomainEvent(
    eventType: string,
    data: Record<string, unknown>,
    contactId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.capture({
      event: eventType,
      distinctId: contactId ?? 'anonymous',
      properties: data,
    });
  }

  async identify(
    distinctId: string,
    properties: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.capture({
      event: '$identify',
      distinctId,
      properties: { $set: properties },
    });
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    const result = await this.capture({
      event: 'mauntic_connection_test',
      distinctId: 'mauntic-test',
      properties: { source: 'mauntic', test: true },
    });

    return {
      success: result.success,
      message: result.success ? 'Connected to PostHog' : result.error,
    };
  }
}

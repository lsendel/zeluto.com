/**
 * Segment event forwarding adapter.
 * Forwards domain events to Segment's tracking API.
 */

export interface SegmentConfig {
  writeKey: string;
}

export interface SegmentEvent {
  type: 'track' | 'identify' | 'page' | 'group';
  userId?: string;
  anonymousId?: string;
  event?: string;
  properties?: Record<string, unknown>;
  traits?: Record<string, unknown>;
  context?: Record<string, unknown>;
  timestamp?: string;
}

const SEGMENT_API = 'https://api.segment.io/v1';

export class SegmentAdapter {
  private writeKey: string;

  constructor(config: SegmentConfig) {
    this.writeKey = config.writeKey;
  }

  static fromConfig(config: Record<string, unknown>): SegmentAdapter {
    return new SegmentAdapter({
      writeKey: config.writeKey as string,
    });
  }

  async track(event: SegmentEvent): Promise<{ success: boolean; error?: string }> {
    try {
      const endpoint = `${SEGMENT_API}/${event.type}`;
      const auth = btoa(`${this.writeKey}:`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          timestamp: event.timestamp ?? new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, error: `Segment returned ${response.status}: ${body}` };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Segment request failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async forwardDomainEvent(
    eventType: string,
    data: Record<string, unknown>,
    contactId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.track({
      type: 'track',
      userId: contactId,
      event: eventType,
      properties: data,
    });
  }

  async identify(
    userId: string,
    traits: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.track({
      type: 'identify',
      userId,
      traits,
    });
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    const result = await this.track({
      type: 'track',
      anonymousId: 'mauntic-connection-test',
      event: 'Connection Test',
      properties: { source: 'mauntic', test: true },
    });

    return {
      success: result.success,
      message: result.success ? 'Connected to Segment' : result.error,
    };
  }
}

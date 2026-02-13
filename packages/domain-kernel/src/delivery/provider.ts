import type { Channel } from '../events/domain-event';

export interface EmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

export interface SmsPayload {
  to: string;
  from: string;
  body: string;
}

export interface PushPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

export interface WebhookPayload {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: unknown;
}

export type ChannelPayload<T extends Channel> =
  T extends 'email' ? EmailPayload :
  T extends 'sms' ? SmsPayload :
  T extends 'push' ? PushPayload :
  T extends 'webhook' ? WebhookPayload :
  never;

export interface DeliveryResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked';

export interface TrackingEvent {
  type: 'open' | 'click' | 'bounce' | 'complaint' | 'unsubscribe';
  externalId: string;
  contactId?: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface DeliveryProvider<TChannel extends Channel> {
  channel: TChannel;
  name: string;
  send(payload: ChannelPayload<TChannel>): Promise<DeliveryResult>;
  checkStatus?(externalId: string): Promise<DeliveryStatus>;
  handleWebhook?(request: unknown): Promise<TrackingEvent[]>;
}

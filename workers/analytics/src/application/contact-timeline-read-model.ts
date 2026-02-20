export type TimelineCategory =
  | 'delivery'
  | 'journey'
  | 'campaign'
  | 'crm'
  | 'form'
  | 'scoring'
  | 'web'
  | 'system';

export interface TimelineEventInput {
  id: string;
  eventType: string;
  eventSource: string | null;
  eventData: unknown;
  createdAt: Date;
}

export function buildContactTimelineReadModel(
  events: TimelineEventInput[],
  pagination: { page: number; limit: number; total: number },
) {
  const sorted = [...events].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const grouped = new Map<
    string,
    {
      id: string;
      eventType: string;
      category: TimelineCategory;
      title: string;
      description: string;
      source: string | null;
      channel: string | null;
      occurredAt: string;
      count: number;
      metadata: Record<string, unknown>;
    }
  >();

  for (const event of sorted) {
    const source = normalizeSource(event.eventSource);
    const minuteBucket = toMinuteBucket(event.createdAt);
    const key = `${event.eventType}|${source ?? ''}|${minuteBucket}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      id: event.id,
      eventType: event.eventType,
      category: classifyCategory(event.eventType, source),
      title: toTitle(event.eventType),
      description: source
        ? `${event.eventType} from ${source}`
        : event.eventType,
      source,
      channel: detectChannel(event.eventType, event.eventData),
      occurredAt: event.createdAt.toISOString(),
      count: 1,
      metadata: isRecord(event.eventData) ? event.eventData : {},
    });
  }

  const data = [...grouped.values()].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );

  return {
    data,
    // Real total count from the DB query, not just the current page size.
    total: pagination.total,
    // How many raw rows were sampled for this page (pre-consolidation).
    pageCount: events.length,
    // Number of buckets after consolidation merges duplicate minute-level events.
    consolidatedCount: data.length,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(pagination.total / pagination.limit),
  };
}

function classifyCategory(
  eventType: string,
  source: string | null,
): TimelineCategory {
  const normalizedType = eventType.toLowerCase();
  const normalizedSource = (source ?? '').toLowerCase();
  if (
    normalizedType.startsWith('delivery.') ||
    normalizedType.includes('email')
  ) {
    return 'delivery';
  }
  if (
    normalizedType.startsWith('journey.') ||
    normalizedSource.includes('journey')
  ) {
    return 'journey';
  }
  if (
    normalizedType.startsWith('campaign.') ||
    normalizedSource.includes('campaign')
  ) {
    return 'campaign';
  }
  if (normalizedType.startsWith('crm.') || normalizedSource.includes('crm')) {
    return 'crm';
  }
  if (normalizedType.startsWith('form.') || normalizedSource.includes('form')) {
    return 'form';
  }
  if (
    normalizedType.startsWith('scoring.') ||
    normalizedSource.includes('score')
  ) {
    return 'scoring';
  }
  if (
    normalizedType.startsWith('web.') ||
    normalizedType.includes('visit') ||
    normalizedSource.includes('web')
  ) {
    return 'web';
  }
  return 'system';
}

function toTitle(eventType: string): string {
  const shortType = eventType.includes('.')
    ? eventType.split('.').slice(-1)[0]
    : eventType;
  return shortType
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function detectChannel(eventType: string, eventData: unknown): string | null {
  if (
    isRecord(eventData) &&
    typeof eventData.channel === 'string' &&
    eventData.channel.trim().length > 0
  ) {
    return eventData.channel;
  }

  const normalizedType = eventType.toLowerCase();
  if (normalizedType.includes('email')) return 'email';
  if (normalizedType.includes('sms')) return 'sms';
  if (normalizedType.includes('push')) return 'push';
  if (normalizedType.includes('linkedin')) return 'linkedin';
  return null;
}

function normalizeSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const trimmed = source.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toMinuteBucket(date: Date): string {
  const minuteMillis = 60 * 1000;
  const roundedMillis =
    Math.floor(date.getTime() / minuteMillis) * minuteMillis;
  return new Date(roundedMillis).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

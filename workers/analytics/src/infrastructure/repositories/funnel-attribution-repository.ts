import { contactActivity } from '@mauntic/analytics-domain/drizzle';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export interface FunnelStepMetric {
  step: string;
  totalEvents: number;
  uniqueContacts: number;
  conversionFromPrevious: number;
}

export interface AttributionSourceMetric {
  source: string;
  conversions: number;
  share: number;
}

export interface AttributionModel {
  totalConversions: number;
  firstTouch: AttributionSourceMetric[];
  lastTouch: AttributionSourceMetric[];
}

export async function getFunnelModel(
  db: NeonHttpDatabase,
  orgId: string,
  input: {
    steps: string[];
    startDate?: string;
    endDate?: string;
  },
): Promise<{ steps: FunnelStepMetric[] }> {
  const normalizedSteps = input.steps
    .map((step) => step.trim())
    .filter((step) => step.length > 0);

  if (normalizedSteps.length === 0) {
    return { steps: [] };
  }

  const conditions = [
    eq(contactActivity.organizationId, orgId),
    inArray(contactActivity.eventType, normalizedSteps),
  ];
  if (input.startDate) {
    conditions.push(gte(contactActivity.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    conditions.push(lte(contactActivity.createdAt, new Date(input.endDate)));
  }

  const rows = await db
    .select({
      eventType: contactActivity.eventType,
      totalEvents: sql<number>`count(*)::int`,
      uniqueContacts: sql<number>`count(distinct ${contactActivity.contactId})::int`,
    })
    .from(contactActivity)
    .where(and(...conditions))
    .groupBy(contactActivity.eventType);

  const byType = new Map(
    rows.map((row) => [
      row.eventType,
      {
        totalEvents: row.totalEvents,
        uniqueContacts: row.uniqueContacts,
      },
    ]),
  );

  const metrics: FunnelStepMetric[] = [];
  let previousUniqueContacts: number | null = null;
  for (const step of normalizedSteps) {
    const row = byType.get(step);
    const uniqueContacts = row?.uniqueContacts ?? 0;
    metrics.push({
      step,
      totalEvents: row?.totalEvents ?? 0,
      uniqueContacts,
      conversionFromPrevious:
        previousUniqueContacts && previousUniqueContacts > 0
          ? round((uniqueContacts / previousUniqueContacts) * 100)
          : 100,
    });
    previousUniqueContacts = uniqueContacts;
  }

  return { steps: metrics };
}

export async function getAttributionModel(
  db: NeonHttpDatabase,
  orgId: string,
  input?: {
    conversionEvents?: string[];
    startDate?: string;
    endDate?: string;
  },
): Promise<AttributionModel> {
  const conversionEvents = input?.conversionEvents?.filter(
    (eventType) => eventType.length > 0,
  ) ?? ['conversion', 'deal_won', 'form_submitted'];

  const conversionConditions = [
    eq(contactActivity.organizationId, orgId),
    inArray(contactActivity.eventType, conversionEvents),
  ];
  if (input?.startDate) {
    conversionConditions.push(
      gte(contactActivity.createdAt, new Date(input.startDate)),
    );
  }
  if (input?.endDate) {
    conversionConditions.push(
      lte(contactActivity.createdAt, new Date(input.endDate)),
    );
  }

  const conversionRows = await db
    .select({
      contactId: contactActivity.contactId,
      conversionAt: sql<Date>`min(${contactActivity.createdAt})`,
    })
    .from(contactActivity)
    .where(and(...conversionConditions))
    .groupBy(contactActivity.contactId);

  if (conversionRows.length === 0) {
    return {
      totalConversions: 0,
      firstTouch: [],
      lastTouch: [],
    };
  }

  const convertedContactIds = conversionRows.map((row) => row.contactId);
  const conversionAtByContact = new Map(
    conversionRows.map((row) => [row.contactId, row.conversionAt]),
  );

  const touchRows = await db
    .select({
      contactId: contactActivity.contactId,
      eventType: contactActivity.eventType,
      eventSource: contactActivity.eventSource,
      eventData: contactActivity.eventData,
      createdAt: contactActivity.createdAt,
    })
    .from(contactActivity)
    .where(
      and(
        eq(contactActivity.organizationId, orgId),
        inArray(contactActivity.contactId, convertedContactIds),
      ),
    );

  const groupedTouches = new Map<
    string,
    Array<{
      eventType: string;
      eventSource: string | null;
      eventData: unknown;
      createdAt: Date;
    }>
  >();
  for (const row of touchRows) {
    const bucket = groupedTouches.get(row.contactId) ?? [];
    bucket.push({
      eventType: row.eventType,
      eventSource: row.eventSource,
      eventData: row.eventData,
      createdAt: row.createdAt,
    });
    groupedTouches.set(row.contactId, bucket);
  }

  const firstTouchCounts = new Map<string, number>();
  const lastTouchCounts = new Map<string, number>();

  for (const contactId of convertedContactIds) {
    const touches = groupedTouches.get(contactId) ?? [];
    const conversionAt = conversionAtByContact.get(contactId);
    const filteredTouches = touches
      .filter((touch) => {
        if (conversionEvents.includes(touch.eventType)) return false;
        if (!conversionAt) return true;
        return touch.createdAt <= conversionAt;
      })
      .sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf());

    const firstTouch = filteredTouches[0];
    const lastTouch = filteredTouches[filteredTouches.length - 1];
    const fallbackSource = 'direct';

    const firstSource = firstTouch
      ? deriveAttributionSource(firstTouch)
      : fallbackSource;
    const lastSource = lastTouch
      ? deriveAttributionSource(lastTouch)
      : fallbackSource;

    firstTouchCounts.set(
      firstSource,
      (firstTouchCounts.get(firstSource) ?? 0) + 1,
    );
    lastTouchCounts.set(lastSource, (lastTouchCounts.get(lastSource) ?? 0) + 1);
  }

  return {
    totalConversions: conversionRows.length,
    firstTouch: toSortedAttributionMetrics(
      firstTouchCounts,
      conversionRows.length,
    ),
    lastTouch: toSortedAttributionMetrics(
      lastTouchCounts,
      conversionRows.length,
    ),
  };
}

function toSortedAttributionMetrics(
  counts: Map<string, number>,
  totalConversions: number,
): AttributionSourceMetric[] {
  return [...counts.entries()]
    .map(([source, conversions]) => ({
      source,
      conversions,
      share:
        totalConversions > 0
          ? round((conversions / totalConversions) * 100)
          : 0,
    }))
    .sort(
      (a, b) =>
        b.conversions - a.conversions || a.source.localeCompare(b.source),
    );
}

function deriveAttributionSource(input: {
  eventType: string;
  eventSource: string | null;
  eventData: unknown;
}): string {
  const sourceFromData = readSourceFromEventData(input.eventData);
  if (sourceFromData) return sourceFromData;

  if (input.eventSource && input.eventSource.trim().length > 0) {
    return input.eventSource.split(':')[0] ?? input.eventSource;
  }

  if (input.eventType.includes('.')) {
    return input.eventType.split('.')[0] ?? input.eventType;
  }
  if (input.eventType.includes('_')) {
    return input.eventType.split('_')[0] ?? input.eventType;
  }

  return input.eventType;
}

function readSourceFromEventData(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const source = payload.channel ?? payload.source ?? payload.medium;
  if (typeof source === 'string' && source.trim().length > 0) {
    return source.trim().toLowerCase();
  }
  return null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

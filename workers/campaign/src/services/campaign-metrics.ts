import { campaignStats } from '@mauntic/campaign-domain/drizzle';
import { sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

type MetricEvent =
  | 'delivery.MessageSent'
  | 'delivery.MessageDelivered'
  | 'delivery.MessageOpened'
  | 'delivery.MessageClicked'
  | 'delivery.MessageBounced'
  | 'delivery.MessageComplained'
  | 'delivery.MessageUnsubscribed';

type MetricIncrements = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
};

const METRIC_MAP: Record<MetricEvent, Partial<MetricIncrements>> = {
  'delivery.MessageSent': { sent: 1 },
  'delivery.MessageDelivered': { delivered: 1 },
  'delivery.MessageOpened': { opened: 1 },
  'delivery.MessageClicked': { clicked: 1 },
  'delivery.MessageBounced': { bounced: 1, failed: 1 },
  'delivery.MessageComplained': { complained: 1 },
  'delivery.MessageUnsubscribed': { unsubscribed: 1 },
};

const ZERO_INCREMENTS: MetricIncrements = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  unsubscribed: 0,
  failed: 0,
};

export async function applyDeliveryFeedback(
  db: NeonHttpDatabase,
  orgId: string,
  campaignId: string,
  eventType: string,
): Promise<void> {
  if (!(eventType in METRIC_MAP)) {
    return;
  }

  const increments = buildIncrements(eventType as MetricEvent);
  const now = new Date();

  await db.transaction(async (tx) => {
    await upsertCampaignStats(tx, orgId, campaignId, increments, now);
    await updateCampaignProjection(
      tx,
      'campaign.campaigns',
      orgId,
      campaignId,
      increments,
      now,
    );
    await updateCampaignProjection(
      tx,
      'campaign.campaign_summaries',
      orgId,
      campaignId,
      increments,
      now,
    );
  });
}

function buildIncrements(event: MetricEvent): MetricIncrements {
  const overrides = METRIC_MAP[event];
  return {
    ...ZERO_INCREMENTS,
    ...overrides,
  };
}

async function upsertCampaignStats(
  db: NeonHttpDatabase | any,
  orgId: string,
  campaignId: string,
  increments: MetricIncrements,
  now: Date,
): Promise<void> {
  const insertValues = {
    id: crypto.randomUUID(),
    campaignId,
    organizationId: orgId,
    totalRecipients: 0,
    sent: increments.sent,
    delivered: increments.delivered,
    opened: increments.opened,
    clicked: increments.clicked,
    bounced: increments.bounced,
    complained: increments.complained,
    unsubscribed: increments.unsubscribed,
    updatedAt: now,
  };

  const updateSet: Record<string, unknown> = {
    updatedAt: now,
  };
  if (increments.sent) {
    updateSet.sent = sql`${campaignStats.sent} + ${increments.sent}`;
  }
  if (increments.delivered) {
    updateSet.delivered = sql`${campaignStats.delivered} + ${increments.delivered}`;
  }
  if (increments.opened) {
    updateSet.opened = sql`${campaignStats.opened} + ${increments.opened}`;
  }
  if (increments.clicked) {
    updateSet.clicked = sql`${campaignStats.clicked} + ${increments.clicked}`;
  }
  if (increments.bounced) {
    updateSet.bounced = sql`${campaignStats.bounced} + ${increments.bounced}`;
  }
  if (increments.complained) {
    updateSet.complained = sql`${campaignStats.complained} + ${increments.complained}`;
  }
  if (increments.unsubscribed) {
    updateSet.unsubscribed = sql`${campaignStats.unsubscribed} + ${increments.unsubscribed}`;
  }

  await db
    .insert(campaignStats)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [campaignStats.campaignId, campaignStats.organizationId],
      set: updateSet,
    });
}

async function updateCampaignProjection(
  db: NeonHttpDatabase | any,
  tableName: 'campaign.campaigns' | 'campaign.campaign_summaries',
  orgId: string,
  campaignId: string,
  increments: MetricIncrements,
  now: Date,
): Promise<void> {
  const shouldUpdateTimestamp =
    increments.sent ||
    increments.delivered ||
    increments.opened ||
    increments.clicked ||
    increments.bounced ||
    increments.complained ||
    increments.unsubscribed;

  await db.execute(sql`
    UPDATE ${sql.raw(tableName)}
    SET
      sent_count = sent_count + ${increments.sent},
      delivered_count = delivered_count + ${increments.delivered},
      open_count = open_count + ${increments.opened},
      click_count = click_count + ${increments.clicked},
      failed_count = failed_count + ${increments.failed},
      bounce_count = bounce_count + ${increments.bounced},
      complaint_count = complaint_count + ${increments.complained},
      unsubscribe_count = unsubscribe_count + ${increments.unsubscribed},
      open_rate = CASE
        WHEN (sent_count + ${increments.sent}) > 0
          THEN ((open_count + ${increments.opened})::float / (sent_count + ${increments.sent})) * 100
        ELSE 0
      END,
      click_rate = CASE
        WHEN (sent_count + ${increments.sent}) > 0
          THEN ((click_count + ${increments.clicked})::float / (sent_count + ${increments.sent})) * 100
        ELSE 0
      END,
      last_event_at = CASE
        WHEN ${shouldUpdateTimestamp ? 1 : 0} = 1 THEN ${now}
        ELSE last_event_at
      END,
      updated_at = ${now}
    WHERE id = ${campaignId} AND organization_id = ${orgId};
  `);
}

import {
  EnvironmentPromotion,
  type EnvironmentPromotionProps,
  type PromotionScope,
} from '@mauntic/integrations-domain';

const PROMOTION_KEY_PREFIX = 'integrations:env-promotion:';
const PROMOTION_INDEX_KEY_PREFIX = 'integrations:env-promotion:index:';

interface StoredEnvironmentPromotion {
  id: string;
  organizationId: string;
  sourceEnvironment: EnvironmentPromotionProps['sourceEnvironment'];
  targetEnvironment: EnvironmentPromotionProps['targetEnvironment'];
  scope: PromotionScope;
  notes: string | null;
  status: EnvironmentPromotionProps['status'];
  requestedBy: string;
  requestedAt: number;
  reviewedBy: string | null;
  reviewedAt: number | null;
  rejectionReason: string | null;
  appliedAt: number | null;
}

export interface EnvironmentPromotionRecord {
  id: string;
  organizationId: string;
  sourceEnvironment: EnvironmentPromotionProps['sourceEnvironment'];
  targetEnvironment: EnvironmentPromotionProps['targetEnvironment'];
  scope: PromotionScope;
  notes: string | null;
  status: EnvironmentPromotionProps['status'];
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  appliedAt: string | null;
}

export async function createEnvironmentPromotion(
  kv: KVNamespace,
  input: {
    organizationId: string;
    sourceEnvironment: EnvironmentPromotionProps['sourceEnvironment'];
    targetEnvironment: EnvironmentPromotionProps['targetEnvironment'];
    scope: PromotionScope;
    notes?: string | null;
    requestedBy: string;
  },
): Promise<EnvironmentPromotionRecord> {
  const promotion = EnvironmentPromotion.create(input);
  const stored = toStored(promotion.toProps());
  await kv.put(promotionKey(stored.id), JSON.stringify(stored));
  await addToOrganizationIndex(kv, stored.organizationId, stored.id);
  return toRecord(stored);
}

export async function listEnvironmentPromotions(
  kv: KVNamespace,
  organizationId: string,
): Promise<EnvironmentPromotionRecord[]> {
  const ids = await readOrganizationIndex(kv, organizationId);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const raw = await kv.get(promotionKey(id));
      if (!raw) return null;
      return parseStored(raw);
    }),
  );

  return rows
    .filter(
      (row): row is StoredEnvironmentPromotion =>
        !!row && row.organizationId === organizationId,
    )
    .sort((left, right) => right.requestedAt - left.requestedAt)
    .map(toRecord);
}

export async function approveEnvironmentPromotion(
  kv: KVNamespace,
  input: {
    organizationId: string;
    promotionId: string;
    reviewedBy: string;
  },
): Promise<EnvironmentPromotionRecord | null> {
  const promotion = await loadPromotion(
    kv,
    input.organizationId,
    input.promotionId,
  );
  if (!promotion) return null;

  promotion.approve({ reviewedBy: input.reviewedBy });
  const stored = toStored(promotion.toProps());
  await kv.put(promotionKey(stored.id), JSON.stringify(stored));
  return toRecord(stored);
}

export async function rejectEnvironmentPromotion(
  kv: KVNamespace,
  input: {
    organizationId: string;
    promotionId: string;
    reviewedBy: string;
    reason: string;
  },
): Promise<EnvironmentPromotionRecord | null> {
  const promotion = await loadPromotion(
    kv,
    input.organizationId,
    input.promotionId,
  );
  if (!promotion) return null;

  promotion.reject({ reviewedBy: input.reviewedBy, reason: input.reason });
  const stored = toStored(promotion.toProps());
  await kv.put(promotionKey(stored.id), JSON.stringify(stored));
  return toRecord(stored);
}

export async function applyEnvironmentPromotion(
  kv: KVNamespace,
  input: {
    organizationId: string;
    promotionId: string;
  },
): Promise<EnvironmentPromotionRecord | null> {
  const promotion = await loadPromotion(
    kv,
    input.organizationId,
    input.promotionId,
  );
  if (!promotion) return null;

  promotion.apply();
  const stored = toStored(promotion.toProps());
  await kv.put(promotionKey(stored.id), JSON.stringify(stored));
  return toRecord(stored);
}

async function loadPromotion(
  kv: KVNamespace,
  organizationId: string,
  promotionId: string,
): Promise<EnvironmentPromotion | null> {
  const raw = await kv.get(promotionKey(promotionId));
  if (!raw) return null;
  const stored = parseStored(raw);
  if (!stored || stored.organizationId !== organizationId) {
    return null;
  }
  return EnvironmentPromotion.reconstitute(toDomain(stored));
}

function toStored(
  props: Readonly<EnvironmentPromotionProps>,
): StoredEnvironmentPromotion {
  return {
    id: props.id,
    organizationId: props.organizationId,
    sourceEnvironment: props.sourceEnvironment,
    targetEnvironment: props.targetEnvironment,
    scope: props.scope,
    notes: props.notes,
    status: props.status,
    requestedBy: props.requestedBy,
    requestedAt: props.requestedAt.valueOf(),
    reviewedBy: props.reviewedBy,
    reviewedAt: props.reviewedAt ? props.reviewedAt.valueOf() : null,
    rejectionReason: props.rejectionReason,
    appliedAt: props.appliedAt ? props.appliedAt.valueOf() : null,
  };
}

function toDomain(
  stored: StoredEnvironmentPromotion,
): EnvironmentPromotionProps {
  return {
    id: stored.id,
    organizationId: stored.organizationId,
    sourceEnvironment: stored.sourceEnvironment,
    targetEnvironment: stored.targetEnvironment,
    scope: stored.scope,
    notes: stored.notes,
    status: stored.status,
    requestedBy: stored.requestedBy,
    requestedAt: new Date(stored.requestedAt),
    reviewedBy: stored.reviewedBy,
    reviewedAt:
      typeof stored.reviewedAt === 'number'
        ? new Date(stored.reviewedAt)
        : null,
    rejectionReason: stored.rejectionReason,
    appliedAt:
      typeof stored.appliedAt === 'number' ? new Date(stored.appliedAt) : null,
  };
}

function toRecord(
  stored: StoredEnvironmentPromotion,
): EnvironmentPromotionRecord {
  return {
    id: stored.id,
    organizationId: stored.organizationId,
    sourceEnvironment: stored.sourceEnvironment,
    targetEnvironment: stored.targetEnvironment,
    scope: stored.scope,
    notes: stored.notes,
    status: stored.status,
    requestedBy: stored.requestedBy,
    requestedAt: new Date(stored.requestedAt).toISOString(),
    reviewedBy: stored.reviewedBy,
    reviewedAt:
      typeof stored.reviewedAt === 'number'
        ? new Date(stored.reviewedAt).toISOString()
        : null,
    rejectionReason: stored.rejectionReason,
    appliedAt:
      typeof stored.appliedAt === 'number'
        ? new Date(stored.appliedAt).toISOString()
        : null,
  };
}

function parseStored(raw: string): StoredEnvironmentPromotion | null {
  try {
    return JSON.parse(raw) as StoredEnvironmentPromotion;
  } catch {
    return null;
  }
}

function promotionKey(id: string): string {
  return `${PROMOTION_KEY_PREFIX}${id}`;
}

function promotionIndexKey(organizationId: string): string {
  return `${PROMOTION_INDEX_KEY_PREFIX}${organizationId}`;
}

async function addToOrganizationIndex(
  kv: KVNamespace,
  organizationId: string,
  promotionId: string,
) {
  const index = await readOrganizationIndex(kv, organizationId);
  if (!index.includes(promotionId)) {
    index.push(promotionId);
    await kv.put(promotionIndexKey(organizationId), JSON.stringify(index));
  }
}

async function readOrganizationIndex(
  kv: KVNamespace,
  organizationId: string,
): Promise<string[]> {
  const raw = await kv.get(promotionIndexKey(organizationId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

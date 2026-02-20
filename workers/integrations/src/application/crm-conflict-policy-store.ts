import {
  type ConflictResolutionDecision,
  type ConflictResolutionInput,
  type ConflictResolutionStrategy,
  CrmConflictPolicy,
  type CrmConflictPolicyProps,
} from '@mauntic/integrations-domain';

const POLICY_KEY_PREFIX = 'integrations:crm-conflict-policy:';

interface StoredCrmConflictPolicy {
  id: string;
  organizationId: string;
  connectionId: string | null;
  defaultStrategy: ConflictResolutionStrategy;
  fieldStrategies: Record<string, ConflictResolutionStrategy>;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface CrmConflictPolicyRecord {
  id: string;
  organizationId: string;
  connectionId: string | null;
  defaultStrategy: ConflictResolutionStrategy;
  fieldStrategies: Record<string, ConflictResolutionStrategy>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function ensureCrmConflictPolicy(
  kv: KVNamespace,
  input: {
    organizationId: string;
    connectionId?: string | null;
    actorUserId: string;
  },
): Promise<CrmConflictPolicyRecord> {
  const existing = await getStoredPolicy(
    kv,
    input.organizationId,
    input.connectionId,
  );
  if (existing) return toRecord(existing);

  const policy = CrmConflictPolicy.create({
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    createdBy: input.actorUserId,
  });
  const stored = toStored(policy.toProps());
  await kv.put(
    policyKey(input.organizationId, input.connectionId),
    JSON.stringify(stored),
  );
  return toRecord(stored);
}

export async function upsertCrmConflictPolicy(
  kv: KVNamespace,
  input: {
    organizationId: string;
    connectionId?: string | null;
    actorUserId: string;
    defaultStrategy?: ConflictResolutionStrategy;
    fieldStrategies?: Record<string, ConflictResolutionStrategy>;
  },
): Promise<CrmConflictPolicyRecord> {
  const existing = await getStoredPolicy(
    kv,
    input.organizationId,
    input.connectionId,
  );
  const policy = existing
    ? CrmConflictPolicy.reconstitute(toDomain(existing))
    : CrmConflictPolicy.create({
        organizationId: input.organizationId,
        connectionId: input.connectionId,
        createdBy: input.actorUserId,
      });

  policy.update({
    defaultStrategy: input.defaultStrategy,
    fieldStrategies: input.fieldStrategies,
    updatedBy: input.actorUserId,
  });

  const stored = toStored(policy.toProps());
  await kv.put(
    policyKey(input.organizationId, input.connectionId),
    JSON.stringify(stored),
  );
  return toRecord(stored);
}

export async function resolveCrmConflictPreview(
  kv: KVNamespace,
  input: {
    organizationId: string;
    connectionId?: string | null;
    actorUserId: string;
    conflict: ConflictResolutionInput;
  },
): Promise<{
  policy: CrmConflictPolicyRecord;
  decision: ConflictResolutionDecision;
}> {
  const policyRecord = await ensureCrmConflictPolicy(kv, {
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    actorUserId: input.actorUserId,
  });
  const policy = CrmConflictPolicy.reconstitute(toDomainRecord(policyRecord));
  return {
    policy: policyRecord,
    decision: policy.resolve(input.conflict),
  };
}

async function getStoredPolicy(
  kv: KVNamespace,
  organizationId: string,
  connectionId?: string | null,
): Promise<StoredCrmConflictPolicy | null> {
  const raw = await kv.get(policyKey(organizationId, connectionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCrmConflictPolicy;
    if (parsed.organizationId !== organizationId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toStored(
  props: Readonly<CrmConflictPolicyProps>,
): StoredCrmConflictPolicy {
  return {
    id: props.id,
    organizationId: props.organizationId,
    connectionId: props.connectionId,
    defaultStrategy: props.defaultStrategy,
    fieldStrategies: props.fieldStrategies,
    createdBy: props.createdBy,
    updatedBy: props.updatedBy,
    createdAt: props.createdAt.valueOf(),
    updatedAt: props.updatedAt.valueOf(),
  };
}

function toDomain(stored: StoredCrmConflictPolicy): CrmConflictPolicyProps {
  return {
    id: stored.id,
    organizationId: stored.organizationId,
    connectionId: stored.connectionId,
    defaultStrategy: stored.defaultStrategy,
    fieldStrategies: stored.fieldStrategies,
    createdBy: stored.createdBy,
    updatedBy: stored.updatedBy,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

function toDomainRecord(
  record: CrmConflictPolicyRecord,
): CrmConflictPolicyProps {
  return {
    id: record.id,
    organizationId: record.organizationId,
    connectionId: record.connectionId,
    defaultStrategy: record.defaultStrategy,
    fieldStrategies: record.fieldStrategies,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toRecord(stored: StoredCrmConflictPolicy): CrmConflictPolicyRecord {
  return {
    id: stored.id,
    organizationId: stored.organizationId,
    connectionId: stored.connectionId,
    defaultStrategy: stored.defaultStrategy,
    fieldStrategies: stored.fieldStrategies,
    createdBy: stored.createdBy,
    updatedBy: stored.updatedBy,
    createdAt: new Date(stored.createdAt).toISOString(),
    updatedAt: new Date(stored.updatedAt).toISOString(),
  };
}

function policyKey(
  organizationId: string,
  connectionId?: string | null,
): string {
  return `${POLICY_KEY_PREFIX}${organizationId}:${connectionId ?? 'default'}`;
}

import { z } from 'zod';

export const ConflictResolutionStrategySchema = z.enum([
  'crm_wins',
  'mauntic_wins',
  'most_recent_wins',
  'manual_review',
]);
export type ConflictResolutionStrategy = z.infer<
  typeof ConflictResolutionStrategySchema
>;

export const CrmConflictPolicyPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  connectionId: z.string().uuid().nullable(),
  defaultStrategy: ConflictResolutionStrategySchema,
  fieldStrategies: z.record(z.string(), ConflictResolutionStrategySchema),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CrmConflictPolicyProps = z.infer<
  typeof CrmConflictPolicyPropsSchema
>;

export interface ConflictResolutionInput {
  field: string;
  localUpdatedAt?: Date | string | null;
  remoteUpdatedAt?: Date | string | null;
}

export interface ConflictResolutionDecision {
  strategy: ConflictResolutionStrategy;
  side: 'crm' | 'mauntic' | 'manual';
}

export class CrmConflictPolicy {
  private constructor(private props: CrmConflictPolicyProps) {}

  static create(input: {
    organizationId: string;
    connectionId?: string | null;
    defaultStrategy?: ConflictResolutionStrategy;
    fieldStrategies?: Record<string, ConflictResolutionStrategy>;
    createdBy: string;
    now?: Date;
  }): CrmConflictPolicy {
    const now = input.now ?? new Date();
    return new CrmConflictPolicy(
      CrmConflictPolicyPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        connectionId: input.connectionId ?? null,
        defaultStrategy: input.defaultStrategy ?? 'most_recent_wins',
        fieldStrategies: normalizeFieldStrategies(input.fieldStrategies),
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static reconstitute(props: CrmConflictPolicyProps): CrmConflictPolicy {
    return new CrmConflictPolicy(CrmConflictPolicyPropsSchema.parse(props));
  }

  update(input: {
    defaultStrategy?: ConflictResolutionStrategy;
    fieldStrategies?: Record<string, ConflictResolutionStrategy>;
    updatedBy: string;
    updatedAt?: Date;
  }) {
    if (input.defaultStrategy) {
      this.props.defaultStrategy = input.defaultStrategy;
    }
    if (input.fieldStrategies) {
      this.props.fieldStrategies = normalizeFieldStrategies(
        input.fieldStrategies,
      );
    }
    this.props.updatedBy = input.updatedBy;
    this.props.updatedAt = input.updatedAt ?? new Date();
  }

  resolve(input: ConflictResolutionInput): ConflictResolutionDecision {
    const fieldKey = normalizeFieldKey(input.field);
    const strategy =
      this.props.fieldStrategies[fieldKey] ?? this.props.defaultStrategy;

    if (strategy === 'crm_wins') {
      return { strategy, side: 'crm' };
    }
    if (strategy === 'mauntic_wins') {
      return { strategy, side: 'mauntic' };
    }
    if (strategy === 'manual_review') {
      return { strategy, side: 'manual' };
    }

    const localUpdatedAt = toTimestamp(input.localUpdatedAt);
    const remoteUpdatedAt = toTimestamp(input.remoteUpdatedAt);
    if (localUpdatedAt === null && remoteUpdatedAt === null) {
      return { strategy, side: 'manual' };
    }
    if (localUpdatedAt === null) {
      return { strategy, side: 'crm' };
    }
    if (remoteUpdatedAt === null) {
      return { strategy, side: 'mauntic' };
    }
    if (remoteUpdatedAt >= localUpdatedAt) {
      return { strategy, side: 'crm' };
    }
    return { strategy, side: 'mauntic' };
  }

  toProps(): Readonly<CrmConflictPolicyProps> {
    return Object.freeze({ ...this.props });
  }
}

function normalizeFieldStrategies(
  fieldStrategies?: Record<string, ConflictResolutionStrategy>,
): Record<string, ConflictResolutionStrategy> {
  if (!fieldStrategies) return {};
  const next: Record<string, ConflictResolutionStrategy> = {};
  for (const [field, strategy] of Object.entries(fieldStrategies)) {
    const key = normalizeFieldKey(field);
    if (!key) continue;
    next[key] = strategy;
  }
  return next;
}

function normalizeFieldKey(field: string): string {
  return field.trim().toLowerCase();
}

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const timestamp =
    value instanceof Date ? value.valueOf() : new Date(value).valueOf();
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

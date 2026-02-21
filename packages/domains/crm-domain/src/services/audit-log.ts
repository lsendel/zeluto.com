import { z } from 'zod';

export const AuditActionSchema = z.enum([
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'contact.merged',
  'contact.preferences_updated',
  'company.created',
  'company.updated',
  'company.deleted',
  'segment.created',
  'segment.updated',
  'segment.deleted',
  'field.created',
  'field.updated',
  'field.deleted',
  'role.changed',
  'member.invited',
  'member.removed',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  action: AuditActionSchema,
  actorId: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.coerce.date(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/**
 * Builds an immutable audit entry.
 * Entries are append-only; no update/delete operations exist.
 */
export function createAuditEntry(input: {
  organizationId: string;
  action: AuditAction;
  actorId: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}): AuditEntry {
  return AuditEntrySchema.parse({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    action: input.action,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata,
    timestamp: new Date(),
  });
}

/**
 * Computes a change delta between before and after snapshots.
 * Returns only the fields that changed.
 */
export function computeChangeDelta(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { from: unknown; to: unknown }> {
  const delta: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  for (const key of allKeys) {
    const fromVal = before?.[key];
    const toVal = after?.[key];
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      delta[key] = { from: fromVal ?? null, to: toVal ?? null };
    }
  }

  return delta;
}

import {
  IntentSignal,
  type IntentSignalRepository,
} from '@mauntic/scoring-domain';
import { intentSignals } from '@mauntic/scoring-domain/drizzle';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

function mapToEntity(row: typeof intentSignals.$inferSelect): IntentSignal {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return IntentSignal.reconstitute({
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    signalType: row.signal_type,
    source: row.source,
    weight: Number(row.weight),
    detectedAt: row.detected_at,
    expiresAt: row.expires_at ?? undefined,
    decayModel: row.decay_model as 'linear' | 'exponential' | 'step',
    decayHours: (metadata._decayHours as number) ?? 168,
    metadata: metadata._decayHours
      ? Object.fromEntries(
          Object.entries(metadata).filter(([k]) => k !== '_decayHours'),
        )
      : metadata,
    createdAt: row.created_at,
  });
}

export class DrizzleIntentSignalRepository implements IntentSignalRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: string, id: string): Promise<IntentSignal | null> {
    const [row] = await this.db
      .select()
      .from(intentSignals)
      .where(
        and(eq(intentSignals.organization_id, orgId), eq(intentSignals.id, id)),
      );
    if (!row) return null;
    return mapToEntity(row);
  }

  async findByContact(
    orgId: string,
    contactId: string,
  ): Promise<IntentSignal[]> {
    const rows = await this.db
      .select()
      .from(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          eq(intentSignals.contact_id, contactId),
        ),
      );
    return rows.map(mapToEntity);
  }

  async findActiveByContact(
    orgId: string,
    contactId: string,
  ): Promise<IntentSignal[]> {
    const rows = await this.db
      .select()
      .from(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          eq(intentSignals.contact_id, contactId),
          sql`(${intentSignals.expires_at} IS NULL OR ${intentSignals.expires_at} > NOW())`,
        ),
      );
    return rows.map(mapToEntity);
  }

  async findByType(orgId: string, signalType: string): Promise<IntentSignal[]> {
    const rows = await this.db
      .select()
      .from(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          eq(intentSignals.signal_type, signalType),
        ),
      );
    return rows.map(mapToEntity);
  }

  async save(signal: IntentSignal): Promise<void> {
    const props = signal.toProps();
    const metadata = {
      ...(props.metadata ?? {}),
      _decayHours: props.decayHours,
    };
    await this.db
      .insert(intentSignals)
      .values({
        id: props.id,
        organization_id: props.organizationId,
        contact_id: props.contactId,
        signal_type: props.signalType,
        source: props.source,
        weight: String(props.weight),
        detected_at: props.detectedAt,
        expires_at: props.expiresAt ?? null,
        decay_model: props.decayModel,
        metadata,
        created_at: props.createdAt,
      })
      .onConflictDoUpdate({
        target: intentSignals.id,
        set: {
          weight: String(props.weight),
          expires_at: props.expiresAt ?? null,
          decay_model: props.decayModel,
          metadata,
        },
      });
  }

  async deleteExpired(orgId: string): Promise<number> {
    const result = await this.db
      .delete(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          lt(intentSignals.expires_at, new Date()),
        ),
      );
    return result.rowCount ?? 0;
  }
}

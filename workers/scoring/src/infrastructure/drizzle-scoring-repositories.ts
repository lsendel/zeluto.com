import type {
  ContactId,
  IntentSignalId,
  OrganizationId,
  SignalAlertId,
} from '@mauntic/domain-kernel';
import {
  IntentSignal,
  type IntentSignalRepository,
  SignalAlert,
  type SignalAlertRepository,
} from '@mauntic/scoring-domain';
import { intentSignals, signalAlerts } from '@mauntic/scoring-domain/drizzle';
import { and, eq, lt } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

const INTENT_SIGNAL_COLUMNS = {
  id: intentSignals.id,
  organization_id: intentSignals.organization_id,
  contact_id: intentSignals.contact_id,
  signal_type: intentSignals.signal_type,
  source: intentSignals.source,
  weight: intentSignals.weight,
  detected_at: intentSignals.detected_at,
  expires_at: intentSignals.expires_at,
  decay_model: intentSignals.decay_model,
  metadata: intentSignals.metadata,
  created_at: intentSignals.created_at,
};

export class DrizzleIntentSignalRepository implements IntentSignalRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(
    orgId: OrganizationId,
    id: IntentSignalId,
  ): Promise<IntentSignal | null> {
    const [row] = await this.db
      .select(INTENT_SIGNAL_COLUMNS)
      .from(intentSignals)
      .where(
        and(eq(intentSignals.id, id), eq(intentSignals.organization_id, orgId)),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByContact(
    orgId: OrganizationId,
    contactId: ContactId,
  ): Promise<IntentSignal[]> {
    const rows = await this.db
      .select(INTENT_SIGNAL_COLUMNS)
      .from(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          eq(intentSignals.contact_id, contactId),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async findActiveByContact(
    orgId: OrganizationId,
    contactId: ContactId,
  ): Promise<IntentSignal[]> {
    const rows = await this.db
      .select(INTENT_SIGNAL_COLUMNS)
      .from(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          eq(intentSignals.contact_id, contactId),
        ),
      );
    return rows.map((r) => this.mapToEntity(r)).filter((s) => !s.isExpired());
  }

  async findByType(
    orgId: OrganizationId,
    signalType: string,
  ): Promise<IntentSignal[]> {
    const rows = await this.db
      .select(INTENT_SIGNAL_COLUMNS)
      .from(intentSignals)
      .where(
        and(
          eq(intentSignals.organization_id, orgId),
          eq(intentSignals.signal_type, signalType),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async save(signal: IntentSignal): Promise<void> {
    const props = signal.toProps();
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
        metadata: props.metadata ?? null,
        created_at: props.createdAt,
      })
      .onConflictDoNothing();
  }

  async deleteExpired(orgId: OrganizationId): Promise<number> {
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

  async deleteAllExpired(): Promise<number> {
    const result = await this.db
      .delete(intentSignals)
      .where(lt(intentSignals.expires_at, new Date()));
    return result.rowCount ?? 0;
  }

  private mapToEntity(row: typeof intentSignals.$inferSelect): IntentSignal {
    const detectedAt = row.detected_at;
    const expiresAt = row.expires_at;
    const decayHours = expiresAt
      ? (expiresAt.getTime() - detectedAt.getTime()) / (1000 * 60 * 60)
      : 168;

    return IntentSignal.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      contactId: row.contact_id,
      signalType: row.signal_type,
      source: row.source,
      weight: Number(row.weight),
      detectedAt,
      expiresAt: expiresAt ?? undefined,
      decayModel: row.decay_model as 'linear' | 'exponential' | 'step',
      decayHours: Math.round(decayHours),
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      createdAt: row.created_at,
    });
  }
}

const SIGNAL_ALERT_COLUMNS = {
  id: signalAlerts.id,
  organization_id: signalAlerts.organization_id,
  contact_id: signalAlerts.contact_id,
  signal_type: signalAlerts.signal_type,
  priority: signalAlerts.priority,
  deadline: signalAlerts.deadline,
  acknowledged_at: signalAlerts.acknowledged_at,
  acknowledged_by: signalAlerts.acknowledged_by,
  status: signalAlerts.status,
  created_at: signalAlerts.created_at,
};

export class DrizzleSignalAlertRepository implements SignalAlertRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(
    orgId: OrganizationId,
    id: SignalAlertId,
  ): Promise<SignalAlert | null> {
    const [row] = await this.db
      .select(SIGNAL_ALERT_COLUMNS)
      .from(signalAlerts)
      .where(
        and(eq(signalAlerts.id, id), eq(signalAlerts.organization_id, orgId)),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    options?: { status?: string; priority?: string; limit?: number },
  ): Promise<SignalAlert[]> {
    const conditions = [eq(signalAlerts.organization_id, orgId)];
    if (options?.status)
      conditions.push(eq(signalAlerts.status, options.status));
    if (options?.priority)
      conditions.push(eq(signalAlerts.priority, options.priority));

    const query = this.db
      .select(SIGNAL_ALERT_COLUMNS)
      .from(signalAlerts)
      .where(and(...conditions));
    const rows = await (options?.limit ? query.limit(options.limit) : query);
    return rows.map((r) => this.mapToEntity(r));
  }

  async findByContact(
    orgId: OrganizationId,
    contactId: ContactId,
  ): Promise<SignalAlert[]> {
    const rows = await this.db
      .select(SIGNAL_ALERT_COLUMNS)
      .from(signalAlerts)
      .where(
        and(
          eq(signalAlerts.organization_id, orgId),
          eq(signalAlerts.contact_id, contactId),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async findOverdue(orgId: OrganizationId): Promise<SignalAlert[]> {
    const rows = await this.db
      .select(SIGNAL_ALERT_COLUMNS)
      .from(signalAlerts)
      .where(
        and(
          eq(signalAlerts.organization_id, orgId),
          eq(signalAlerts.status, 'open'),
          lt(signalAlerts.deadline, new Date()),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async save(alert: SignalAlert): Promise<void> {
    const props = alert.toProps();
    const [existing] = await this.db
      .select({ id: signalAlerts.id })
      .from(signalAlerts)
      .where(eq(signalAlerts.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(signalAlerts)
        .set({
          status: props.status,
          acknowledged_at: props.acknowledgedAt ?? null,
          acknowledged_by: props.acknowledgedBy ?? null,
        })
        .where(eq(signalAlerts.id, props.id));
    } else {
      await this.db.insert(signalAlerts).values({
        id: props.id,
        organization_id: props.organizationId,
        contact_id: props.contactId,
        signal_type: props.signalType,
        priority: props.priority,
        deadline: props.deadline,
        status: props.status,
        created_at: props.createdAt,
      });
    }
  }

  async expireOverdue(): Promise<number> {
    const result = await this.db
      .update(signalAlerts)
      .set({ status: 'expired' })
      .where(
        and(
          eq(signalAlerts.status, 'open'),
          lt(signalAlerts.deadline, new Date()),
        ),
      );
    return result.rowCount ?? 0;
  }

  private mapToEntity(row: typeof signalAlerts.$inferSelect): SignalAlert {
    return SignalAlert.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      contactId: row.contact_id,
      signalType: row.signal_type,
      priority: row.priority as 'critical' | 'high' | 'medium' | 'low',
      deadline: row.deadline,
      acknowledgedAt: row.acknowledged_at ?? undefined,
      acknowledgedBy: row.acknowledged_by ?? undefined,
      status: row.status as 'open' | 'acknowledged' | 'expired',
      createdAt: row.created_at,
    });
  }
}

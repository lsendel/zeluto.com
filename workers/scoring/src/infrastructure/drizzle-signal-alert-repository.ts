import {
  SignalAlert,
  type SignalAlertRepository,
} from '@mauntic/scoring-domain';
import { signalAlerts } from '@mauntic/scoring-domain/drizzle';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

function mapToEntity(row: typeof signalAlerts.$inferSelect): SignalAlert {
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

export class DrizzleSignalAlertRepository implements SignalAlertRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: string, id: string): Promise<SignalAlert | null> {
    const [row] = await this.db
      .select()
      .from(signalAlerts)
      .where(
        and(eq(signalAlerts.organization_id, orgId), eq(signalAlerts.id, id)),
      );
    if (!row) return null;
    return mapToEntity(row);
  }

  async findByOrganization(
    orgId: string,
    options?: { status?: string; priority?: string; limit?: number },
  ): Promise<SignalAlert[]> {
    const conditions: any[] = [eq(signalAlerts.organization_id, orgId)];
    if (options?.status) {
      conditions.push(eq(signalAlerts.status, options.status));
    }
    if (options?.priority) {
      conditions.push(eq(signalAlerts.priority, options.priority));
    }
    const rows = await this.db
      .select()
      .from(signalAlerts)
      .where(and(...conditions))
      .orderBy(desc(signalAlerts.created_at))
      .limit(options?.limit ?? 50);
    return rows.map(mapToEntity);
  }

  async findByContact(
    orgId: string,
    contactId: string,
  ): Promise<SignalAlert[]> {
    const rows = await this.db
      .select()
      .from(signalAlerts)
      .where(
        and(
          eq(signalAlerts.organization_id, orgId),
          eq(signalAlerts.contact_id, contactId),
        ),
      );
    return rows.map(mapToEntity);
  }

  async findOverdue(orgId: string): Promise<SignalAlert[]> {
    const rows = await this.db
      .select()
      .from(signalAlerts)
      .where(
        and(
          eq(signalAlerts.organization_id, orgId),
          eq(signalAlerts.status, 'open'),
          lt(signalAlerts.deadline, new Date()),
        ),
      );
    return rows.map(mapToEntity);
  }

  async save(alert: SignalAlert): Promise<void> {
    const props = alert.toProps();
    await this.db
      .insert(signalAlerts)
      .values({
        id: props.id,
        organization_id: props.organizationId,
        contact_id: props.contactId,
        signal_type: props.signalType,
        priority: props.priority,
        deadline: props.deadline,
        acknowledged_at: props.acknowledgedAt ?? null,
        acknowledged_by: props.acknowledgedBy ?? null,
        status: props.status,
        created_at: props.createdAt,
      })
      .onConflictDoUpdate({
        target: signalAlerts.id,
        set: {
          status: props.status,
          acknowledged_at: props.acknowledgedAt ?? null,
          acknowledged_by: props.acknowledgedBy ?? null,
        },
      });
  }
}

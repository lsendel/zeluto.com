import type { JourneyId, OrganizationId } from '@mauntic/domain-kernel';
import type { JourneyTriggerRepository } from '@mauntic/journey-domain';
import { JourneyTrigger, type TriggerType } from '@mauntic/journey-domain';
import { journey_triggers } from '@mauntic/journey-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleJourneyTriggerRepository
  implements JourneyTriggerRepository
{
  constructor(private readonly db: NeonHttpDatabase) {}

  async findByJourney(
    orgId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<JourneyTrigger[]> {
    const rows = await this.db
      .select()
      .from(journey_triggers)
      .where(
        and(
          eq(journey_triggers.journey_id, journeyId),
          eq(journey_triggers.organization_id, orgId),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async findByEventType(
    orgId: OrganizationId,
    eventType: string,
  ): Promise<JourneyTrigger[]> {
    const rows = await this.db
      .select()
      .from(journey_triggers)
      .where(
        and(
          eq(journey_triggers.type, eventType),
          eq(journey_triggers.organization_id, orgId),
        ),
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  async save(trigger: JourneyTrigger): Promise<void> {
    const props = trigger.toProps();
    const [existing] = await this.db
      .select({ id: journey_triggers.id })
      .from(journey_triggers)
      .where(eq(journey_triggers.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(journey_triggers)
        .set({
          type: props.type,
          config: props.config,
        })
        .where(eq(journey_triggers.id, props.id));
    } else {
      await this.db.insert(journey_triggers).values({
        id: props.id,
        journey_id: props.journeyId,
        organization_id: props.organizationId,
        type: props.type,
        config: props.config,
      });
    }
  }

  async delete(orgId: OrganizationId, id: string): Promise<void> {
    await this.db
      .delete(journey_triggers)
      .where(
        and(
          eq(journey_triggers.id, id),
          eq(journey_triggers.organization_id, orgId),
        ),
      );
  }

  private mapToEntity(
    row: typeof journey_triggers.$inferSelect,
  ): JourneyTrigger {
    return JourneyTrigger.reconstitute({
      id: row.id,
      journeyId: row.journey_id,
      organizationId: row.organization_id,
      type: row.type as TriggerType,
      config: row.config as Record<string, unknown>,
    }).getValue();
  }
}

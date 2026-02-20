import type {
  ScoringConfigEntry,
  ScoringConfigRepository,
} from '@mauntic/scoring-domain';
import { scoringConfigs } from '@mauntic/scoring-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

function mapToEntry(
  row: typeof scoringConfigs.$inferSelect,
): ScoringConfigEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    category: row.category,
    factor: row.factor,
    weight: Number(row.weight),
    enabled: row.enabled,
  };
}

export class DrizzleScoringConfigRepository implements ScoringConfigRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findByOrganization(orgId: string): Promise<ScoringConfigEntry[]> {
    const rows = await this.db
      .select()
      .from(scoringConfigs)
      .where(eq(scoringConfigs.organization_id, orgId));
    return rows.map(mapToEntry);
  }

  async findByCategory(
    orgId: string,
    category: string,
  ): Promise<ScoringConfigEntry[]> {
    const rows = await this.db
      .select()
      .from(scoringConfigs)
      .where(
        and(
          eq(scoringConfigs.organization_id, orgId),
          eq(scoringConfigs.category, category),
        ),
      );
    return rows.map(mapToEntry);
  }

  async save(config: ScoringConfigEntry): Promise<void> {
    await this.db
      .insert(scoringConfigs)
      .values({
        id: config.id,
        organization_id: config.organizationId,
        category: config.category,
        factor: config.factor,
        weight: String(config.weight),
        enabled: config.enabled,
      })
      .onConflictDoUpdate({
        target: scoringConfigs.id,
        set: {
          category: config.category,
          factor: config.factor,
          weight: String(config.weight),
          enabled: config.enabled,
          updated_at: new Date(),
        },
      });
  }

  async saveBatch(configs: ScoringConfigEntry[]): Promise<void> {
    if (!configs.length) return;
    for (const config of configs) {
      await this.save(config);
    }
  }

  async delete(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(scoringConfigs)
      .where(
        and(
          eq(scoringConfigs.organization_id, orgId),
          eq(scoringConfigs.id, id),
        ),
      );
  }
}

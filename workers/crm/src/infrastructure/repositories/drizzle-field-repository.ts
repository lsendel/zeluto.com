import {
  Field,
  type FieldEntityType,
  type FieldRepository,
} from '@mauntic/crm-domain';
import { fields } from '@mauntic/crm-domain/drizzle';
import type { OrganizationId } from '@mauntic/domain-kernel';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleFieldRepository implements FieldRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: OrganizationId, id: string): Promise<Field | null> {
    const [row] = await this.db
      .select()
      .from(fields)
      .where(and(eq(fields.id, id), eq(fields.organization_id, orgId)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByName(
    orgId: OrganizationId,
    entityType: FieldEntityType,
    name: string,
  ): Promise<Field | null> {
    const [row] = await this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.organization_id, orgId),
          eq(fields.entity_type, entityType),
          eq(fields.name, name),
        ),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    entityType?: FieldEntityType,
  ): Promise<Field[]> {
    const conditions = [eq(fields.organization_id, orgId)];
    if (entityType) {
      conditions.push(eq(fields.entity_type, entityType));
    }

    const rows = await this.db
      .select()
      .from(fields)
      .where(and(...conditions))
      .orderBy(fields.sort_order);

    return rows.map((r) => this.mapToEntity(r));
  }

  async save(field: Field): Promise<void> {
    const props = field.toProps();
    const [existing] = await this.db
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(fields)
        .set({
          label: props.label,
          options: props.options,
          is_required: props.isRequired,
          sort_order: props.sortOrder,
        })
        .where(eq(fields.id, props.id));
    } else {
      await this.db.insert(fields).values({
        id: props.id,
        organization_id: props.organizationId,
        entity_type: props.entityType,
        name: props.name,
        label: props.label,
        field_type: props.fieldType,
        options: props.options,
        is_required: props.isRequired,
        sort_order: props.sortOrder,
        created_at: props.createdAt,
      });
    }
  }

  async delete(orgId: OrganizationId, id: string): Promise<void> {
    await this.db
      .delete(fields)
      .where(and(eq(fields.id, id), eq(fields.organization_id, orgId)));
  }

  private mapToEntity(row: typeof fields.$inferSelect): Field {
    return Field.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      entityType: row.entity_type as FieldEntityType,
      name: row.name,
      label: row.label,
      fieldType: row.field_type as
        | 'text'
        | 'number'
        | 'date'
        | 'select'
        | 'multiselect',
      options: (row.options as string[] | null) ?? null,
      isRequired: row.is_required,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    });
  }
}

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { fields } from '@mauntic/crm-domain/drizzle';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

type Env = {
  Bindings: { DATABASE_URL: string; KV: KVNamespace };
  Variables: { tenant: TenantContext; db: NeonHttpDatabase };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeField(row: Record<string, unknown>) {
  return {
    id: row.id,
    entityType: row.entity_type,
    name: row.name,
    label: row.label,
    fieldType: row.field_type,
    options: row.options ?? null,
    isRequired: row.is_required ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const fieldRoutes = new Hono<Env>();

// GET /api/v1/crm/fields - List fields (optionally filtered by entityType)
fieldRoutes.get('/api/v1/crm/fields', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const entityType = c.req.query('entityType') as
    | 'contact'
    | 'company'
    | undefined;

  try {
    const conditions = [eq(fields.organization_id, tenant.organizationId)];
    if (entityType) {
      conditions.push(eq(fields.entity_type, entityType));
    }

    const rows = await db
      .select()
      .from(fields)
      .where(and(...conditions))
      .orderBy(fields.sort_order);

    return c.json(rows.map(serializeField));
  } catch (error) {
    console.error('Error listing fields:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list fields' },
      500,
    );
  }
});

// POST /api/v1/crm/fields - Create field
fieldRoutes.post('/api/v1/crm/fields', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      entityType: 'contact' | 'company';
      name: string;
      label: string;
      fieldType: 'text' | 'number' | 'date' | 'select' | 'multiselect';
      options?: string[];
      isRequired?: boolean;
      sortOrder?: number;
    }>();

    if (!body.entityType || !body.name || !body.label || !body.fieldType) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'entityType, name, label, and fieldType are required',
        },
        400,
      );
    }

    // Check for duplicate name within org + entity type
    const [existing] = await db
      .select({ id: fields.id })
      .from(fields)
      .where(
        and(
          eq(fields.organization_id, tenant.organizationId),
          eq(fields.entity_type, body.entityType),
          eq(fields.name, body.name),
        ),
      )
      .limit(1);

    if (existing) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: `Field "${body.name}" already exists for ${body.entityType}`,
        },
        400,
      );
    }

    // Validate options for select/multiselect
    if (
      (body.fieldType === 'select' || body.fieldType === 'multiselect') &&
      (!body.options || body.options.length === 0)
    ) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'options are required for select/multiselect fields',
        },
        400,
      );
    }

    const [created] = await db
      .insert(fields)
      .values({
        organization_id: tenant.organizationId,
        entity_type: body.entityType,
        name: body.name,
        label: body.label,
        field_type: body.fieldType,
        options: body.options ?? null,
        is_required: body.isRequired ?? false,
        sort_order: body.sortOrder ?? 0,
      })
      .returning();

    return c.json(serializeField(created), 201);
  } catch (error) {
    console.error('Error creating field:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create field' },
      500,
    );
  }
});

// PATCH /api/v1/crm/fields/:id - Update field
fieldRoutes.patch('/api/v1/crm/fields/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const fieldId = c.req.param('id');

  try {
    // Verify field exists and belongs to this org
    const [existing] = await db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.id, fieldId),
          eq(fields.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Field not found' }, 404);
    }

    const body = await c.req.json<{
      label?: string;
      options?: string[];
      isRequired?: boolean;
      sortOrder?: number;
    }>();

    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.options !== undefined) updates.options = body.options;
    if (body.isRequired !== undefined) updates.is_required = body.isRequired;
    if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder;

    if (Object.keys(updates).length === 0) {
      return c.json(serializeField(existing));
    }

    const [updated] = await db
      .update(fields)
      .set(updates)
      .where(eq(fields.id, fieldId))
      .returning();

    return c.json(serializeField(updated));
  } catch (error) {
    console.error('Error updating field:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update field' },
      500,
    );
  }
});

// DELETE /api/v1/crm/fields/:id - Delete field
fieldRoutes.delete('/api/v1/crm/fields/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const fieldId = c.req.param('id');

  try {
    const [existing] = await db
      .select({ id: fields.id })
      .from(fields)
      .where(
        and(
          eq(fields.id, fieldId),
          eq(fields.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Field not found' }, 404);
    }

    await db.delete(fields).where(eq(fields.id, fieldId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting field:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete field' },
      500,
    );
  }
});

export default fieldRoutes;

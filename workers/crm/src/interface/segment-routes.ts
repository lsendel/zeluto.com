import {
  contacts,
  segment_contacts,
  segments,
} from '@mauntic/crm-domain/drizzle';
import type { TenantContext } from '@mauntic/domain-kernel';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import {
  buildFilterWhere,
  type FilterCriteria,
} from '../services/filter-engine.js';
import {
  querySegmentContacts,
  SegmentNotFoundError,
} from '../services/segment-query.js';

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

function serializeSegment(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    type: row.type,
    filters: row.filter_criteria ?? {},
    contactCount: row.contact_count ?? 0,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const segmentRoutes = new Hono<Env>();

// GET /api/v1/crm/segments - List segments
segmentRoutes.get('/api/v1/crm/segments', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  const page = Number(c.req.query('page') || '1');
  const limit = Math.min(Number(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  try {
    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(segments)
        .where(eq(segments.organization_id, tenant.organizationId))
        .orderBy(desc(segments.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(segments)
        .where(eq(segments.organization_id, tenant.organizationId)),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return c.json({
      data: rows.map(serializeSegment),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error listing segments:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list segments' },
      500,
    );
  }
});

// POST /api/v1/crm/segments - Create segment
segmentRoutes.post('/api/v1/crm/segments', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      type: 'static' | 'dynamic';
      description?: string;
      filters?: Record<string, unknown>;
    }>();

    if (!body.name || !body.type) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'name and type are required' },
        400,
      );
    }

    if (body.type !== 'static' && body.type !== 'dynamic') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'type must be static or dynamic' },
        400,
      );
    }

    // For dynamic segments, compute initial contact count
    let contactCount = 0;
    if (body.type === 'dynamic' && body.filters) {
      const criteria = body.filters as unknown as FilterCriteria;
      const where = buildFilterWhere(criteria, tenant.organizationId);
      const result = await db
        .select({ total: count() })
        .from(contacts)
        .where(where);
      contactCount = result[0]?.total ?? 0;
    }

    const [created] = await db
      .insert(segments)
      .values({
        organization_id: tenant.organizationId,
        name: body.name,
        description: body.description ?? null,
        type: body.type,
        filter_criteria: body.filters ?? null,
        contact_count: contactCount,
      })
      .returning();

    return c.json(serializeSegment(created), 201);
  } catch (error) {
    console.error('Error creating segment:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create segment' },
      500,
    );
  }
});

// GET /api/v1/crm/segments/:id - Get segment
segmentRoutes.get('/api/v1/crm/segments/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const segmentId = c.req.param('id');

  try {
    const [segment] = await db
      .select()
      .from(segments)
      .where(
        and(
          eq(segments.id, segmentId),
          eq(segments.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!segment) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }

    // For dynamic segments, recompute contact count
    if (segment.type === 'dynamic' && segment.filter_criteria) {
      const criteria = segment.filter_criteria as unknown as FilterCriteria;
      const where = buildFilterWhere(criteria, tenant.organizationId);
      const result = await db
        .select({ total: count() })
        .from(contacts)
        .where(where);
      const currentCount = result[0]?.total ?? 0;

      // Update count if changed (best-effort, do not fail request)
      if (currentCount !== segment.contact_count) {
        await db
          .update(segments)
          .set({ contact_count: currentCount, updated_at: new Date() })
          .where(eq(segments.id, segmentId));
        segment.contact_count = currentCount;
      }
    }

    return c.json(serializeSegment(segment));
  } catch (error) {
    console.error('Error getting segment:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get segment' },
      500,
    );
  }
});

// PATCH /api/v1/crm/segments/:id - Update segment
segmentRoutes.patch('/api/v1/crm/segments/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const segmentId = c.req.param('id');

  try {
    // Verify segment exists and belongs to this org
    const [existing] = await db
      .select()
      .from(segments)
      .where(
        and(
          eq(segments.id, segmentId),
          eq(segments.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }

    const body = await c.req.json<{
      name?: string;
      description?: string;
      filters?: Record<string, unknown>;
    }>();

    const updates: Record<string, unknown> = { updated_at: new Date() };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.filters !== undefined) {
      updates.filter_criteria = body.filters;

      // Recompute contact count for dynamic segments
      if (existing.type === 'dynamic') {
        const criteria = body.filters as unknown as FilterCriteria;
        const where = buildFilterWhere(criteria, tenant.organizationId);
        const result = await db
          .select({ total: count() })
          .from(contacts)
          .where(where);
        updates.contact_count = result[0]?.total ?? 0;
      }
    }

    const [updated] = await db
      .update(segments)
      .set(updates)
      .where(eq(segments.id, segmentId))
      .returning();

    return c.json(serializeSegment(updated));
  } catch (error) {
    console.error('Error updating segment:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update segment' },
      500,
    );
  }
});

// DELETE /api/v1/crm/segments/:id - Delete segment
segmentRoutes.delete('/api/v1/crm/segments/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const segmentId = c.req.param('id');

  try {
    // Verify segment exists
    const [existing] = await db
      .select({ id: segments.id })
      .from(segments)
      .where(
        and(
          eq(segments.id, segmentId),
          eq(segments.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(segment_contacts)
        .where(eq(segment_contacts.segment_id, segmentId));

      await tx.delete(segments).where(eq(segments.id, segmentId));
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting segment:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete segment' },
      500,
    );
  }
});

// POST /api/v1/crm/segments/:id/contacts - Add contacts to static segment
segmentRoutes.post('/api/v1/crm/segments/:id/contacts', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const segmentId = c.req.param('id');

  try {
    // Verify segment exists and is static
    const [segment] = await db
      .select()
      .from(segments)
      .where(
        and(
          eq(segments.id, segmentId),
          eq(segments.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!segment) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }

    if (segment.type !== 'static') {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Cannot manually add contacts to a dynamic segment',
        },
        400,
      );
    }

    const body = await c.req.json<{ contactIds: string[] }>();

    if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'contactIds array is required' },
        400,
      );
    }

    // Verify contacts belong to this org
    const validContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, body.contactIds),
          eq(contacts.organization_id, tenant.organizationId),
        ),
      );

    const validIds = new Set(validContacts.map((c) => c.id));

    // Get existing segment_contacts to avoid duplicates
    const existingLinks = await db
      .select({ contact_id: segment_contacts.contact_id })
      .from(segment_contacts)
      .where(
        and(
          eq(segment_contacts.segment_id, segmentId),
          inArray(
            segment_contacts.contact_id,
            body.contactIds.filter((id) => validIds.has(id)),
          ),
        ),
      );

    const existingIds = new Set(existingLinks.map((l) => l.contact_id));

    const toInsert = body.contactIds.filter(
      (id) => validIds.has(id) && !existingIds.has(id),
    );

    if (toInsert.length > 0) {
      await db.transaction(async (tx) => {
        await tx.insert(segment_contacts).values(
          toInsert.map((contactId) => ({
            segment_id: segmentId,
            contact_id: contactId,
          })),
        );

        await tx
          .update(segments)
          .set({
            contact_count: sql`${segments.contact_count} + ${toInsert.length}`,
            updated_at: new Date(),
          })
          .where(eq(segments.id, segmentId));
      });
    }

    return c.json({ added: toInsert.length });
  } catch (error) {
    console.error('Error adding contacts to segment:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to add contacts to segment' },
      500,
    );
  }
});

// DELETE /api/v1/crm/segments/:id/contacts - Remove contacts from static segment
segmentRoutes.delete('/api/v1/crm/segments/:id/contacts', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const segmentId = c.req.param('id');

  try {
    // Verify segment exists and is static
    const [segment] = await db
      .select()
      .from(segments)
      .where(
        and(
          eq(segments.id, segmentId),
          eq(segments.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!segment) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }

    if (segment.type !== 'static') {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Cannot manually remove contacts from a dynamic segment',
        },
        400,
      );
    }

    const body = await c.req.json<{ contactIds: string[] }>();

    if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'contactIds array is required' },
        400,
      );
    }

    let removed = 0;

    await db.transaction(async (tx) => {
      const result = await tx
        .delete(segment_contacts)
        .where(
          and(
            eq(segment_contacts.segment_id, segmentId),
            inArray(segment_contacts.contact_id, body.contactIds),
          ),
        )
        .returning({ id: segment_contacts.id });

      removed = result.length;

      if (removed > 0) {
        await tx
          .update(segments)
          .set({
            contact_count: sql`GREATEST(${segments.contact_count} - ${removed}, 0)`,
            updated_at: new Date(),
          })
          .where(eq(segments.id, segmentId));
      }
    });

    return c.json({ removed });
  } catch (error) {
    console.error('Error removing contacts from segment:', error);
    return c.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove contacts from segment',
      },
      500,
    );
  }
});

// POST /api/v1/crm/segments/:id/query - Fetch paginated contacts for a segment
segmentRoutes.post('/api/v1/crm/segments/:id/query', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const segmentId = c.req.param('id');

  try {
    const body = await c.req
      .json<{ cursor?: string; limit?: number }>()
      .catch(() => ({}) as { cursor?: string; limit?: number });
    const result = await querySegmentContacts(db, {
      organizationId: tenant.organizationId,
      segmentId,
      cursor: body.cursor,
      limit: body.limit,
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof SegmentNotFoundError) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }
    console.error('Error querying segment contacts:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to query segment contacts' },
      500,
    );
  }
});

export default segmentRoutes;

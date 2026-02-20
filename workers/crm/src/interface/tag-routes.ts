import { contact_tags, contacts, tags } from '@mauntic/crm-domain/drizzle';
import type { TenantContext } from '@mauntic/domain-kernel';
import { and, eq, inArray } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';

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

function serializeTag(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Tag CRUD routes
// ---------------------------------------------------------------------------

export const tagRoutes = new Hono<Env>();

// GET /api/v1/crm/tags - List tags for organization
tagRoutes.get('/api/v1/crm/tags', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const rows = await db
      .select()
      .from(tags)
      .where(eq(tags.organization_id, tenant.organizationId))
      .orderBy(tags.name);

    return c.json(rows.map(serializeTag));
  } catch (error) {
    console.error('Error listing tags:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list tags' },
      500,
    );
  }
});

// POST /api/v1/crm/tags - Create tag
tagRoutes.post('/api/v1/crm/tags', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{ name: string; color: string }>();

    if (!body.name) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'name is required' },
        400,
      );
    }

    // Check for duplicate name within org
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.organization_id, tenant.organizationId),
          eq(tags.name, body.name),
        ),
      )
      .limit(1);

    if (existing) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: `Tag "${body.name}" already exists`,
        },
        400,
      );
    }

    const [created] = await db
      .insert(tags)
      .values({
        organization_id: tenant.organizationId,
        name: body.name,
        color: body.color ?? null,
      })
      .returning();

    return c.json(serializeTag(created), 201);
  } catch (error) {
    console.error('Error creating tag:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create tag' },
      500,
    );
  }
});

// DELETE /api/v1/crm/tags/:id - Delete tag
tagRoutes.delete('/api/v1/crm/tags/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const tagId = c.req.param('id');

  try {
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.id, tagId),
          eq(tags.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Tag not found' }, 404);
    }

    // Remove all contact_tags associations first
    await db.delete(contact_tags).where(eq(contact_tags.tag_id, tagId));

    // Delete the tag
    await db.delete(tags).where(eq(tags.id, tagId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete tag' },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Contact tag / untag routes
// ---------------------------------------------------------------------------

// POST /api/v1/crm/contacts/:id/tags - Tag a contact
tagRoutes.post('/api/v1/crm/contacts/:id/tags', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.param('id');

  try {
    // Verify contact exists and belongs to org
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!contact) {
      return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
    }

    const body = await c.req.json<{ tagIds: string[] }>();

    if (!Array.isArray(body.tagIds) || body.tagIds.length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'tagIds array is required' },
        400,
      );
    }

    // Verify tags belong to this org
    const validTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          inArray(tags.id, body.tagIds),
          eq(tags.organization_id, tenant.organizationId),
        ),
      );

    const validTagIds = new Set(validTags.map((t) => t.id));

    // Get existing tag links to avoid duplicates
    const existingLinks = await db
      .select({ tag_id: contact_tags.tag_id })
      .from(contact_tags)
      .where(
        and(
          eq(contact_tags.contact_id, contactId),
          inArray(
            contact_tags.tag_id,
            body.tagIds.filter((id) => validTagIds.has(id)),
          ),
        ),
      );

    const existingTagIds = new Set(existingLinks.map((l) => l.tag_id));

    const toInsert = body.tagIds.filter(
      (id) => validTagIds.has(id) && !existingTagIds.has(id),
    );

    if (toInsert.length > 0) {
      await db.insert(contact_tags).values(
        toInsert.map((tagId) => ({
          contact_id: contactId,
          tag_id: tagId,
        })),
      );
    }

    return c.json({ added: toInsert.length });
  } catch (error) {
    console.error('Error tagging contact:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to tag contact' },
      500,
    );
  }
});

// DELETE /api/v1/crm/contacts/:id/tags - Untag a contact
tagRoutes.delete('/api/v1/crm/contacts/:id/tags', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.param('id');

  try {
    // Verify contact exists and belongs to org
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.organization_id, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!contact) {
      return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
    }

    const body = await c.req.json<{ tagIds: string[] }>();

    if (!Array.isArray(body.tagIds) || body.tagIds.length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'tagIds array is required' },
        400,
      );
    }

    const result = await db
      .delete(contact_tags)
      .where(
        and(
          eq(contact_tags.contact_id, contactId),
          inArray(contact_tags.tag_id, body.tagIds),
        ),
      )
      .returning({ id: contact_tags.id });

    return c.json({ removed: result.length });
  } catch (error) {
    console.error('Error untagging contact:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to untag contact' },
      500,
    );
  }
});

export default tagRoutes;

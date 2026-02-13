import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findContactById,
  findContactByEmail,
  findAllContacts,
  createContact,
  updateContact,
  deleteContact,
  countContactsByOrg,
} from '../infrastructure/repositories/contact-repository.js';

export const contactRoutes = new Hono<Env>();

// GET /api/v1/crm/contacts - List contacts (paginated, searchable)
contactRoutes.get('/api/v1/crm/contacts', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllContacts(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      search: search || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List contacts error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list contacts' }, 500);
  }
});

// POST /api/v1/crm/contacts - Create contact
contactRoutes.post('/api/v1/crm/contacts', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      customFields?: Record<string, unknown>;
    }>();

    if (!body.email && !body.firstName && !body.lastName) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'At least email, firstName, or lastName is required' },
        400,
      );
    }

    // Check for duplicate email within org
    if (body.email) {
      const existing = await findContactByEmail(db, tenant.organizationId, body.email);
      if (existing) {
        return c.json(
          { code: 'CONFLICT', message: `Contact with email ${body.email} already exists` },
          400,
        );
      }
    }

    const contact = await createContact(db, tenant.organizationId, {
      email: body.email ?? '',
      first_name: body.firstName ?? null,
      last_name: body.lastName ?? null,
      phone: body.phone ?? null,
      custom_fields: body.customFields ?? null,
    });

    return c.json(contact, 201);
  } catch (error) {
    console.error('Create contact error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create contact' }, 500);
  }
});

// GET /api/v1/crm/contacts/:id - Get contact by ID
contactRoutes.get('/api/v1/crm/contacts/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const contact = await findContactById(db, tenant.organizationId, id);
    if (!contact) {
      return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
    }
    return c.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get contact' }, 500);
  }
});

// PATCH /api/v1/crm/contacts/:id - Update contact
contactRoutes.patch('/api/v1/crm/contacts/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      status?: string;
      customFields?: Record<string, unknown>;
    }>();

    // Check email uniqueness if changing email
    if (body.email) {
      const existing = await findContactByEmail(db, tenant.organizationId, body.email);
      if (existing && existing.id !== id) {
        return c.json(
          { code: 'CONFLICT', message: `Contact with email ${body.email} already exists` },
          400,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.email !== undefined) updateData.email = body.email;
    if (body.firstName !== undefined) updateData.first_name = body.firstName;
    if (body.lastName !== undefined) updateData.last_name = body.lastName;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.customFields !== undefined) updateData.custom_fields = body.customFields;

    const contact = await updateContact(db, tenant.organizationId, id, updateData);
    if (!contact) {
      return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
    }

    return c.json(contact);
  } catch (error) {
    console.error('Update contact error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update contact' }, 500);
  }
});

// DELETE /api/v1/crm/contacts/:id - Delete contact
contactRoutes.delete('/api/v1/crm/contacts/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteContact(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete contact' }, 500);
  }
});

// POST /api/v1/crm/contacts/import - Bulk import contacts
contactRoutes.post('/api/v1/crm/contacts/import', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      contacts: Array<{
        email?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        customFields?: Record<string, unknown>;
      }>;
    }>();

    if (!body.contacts || !Array.isArray(body.contacts)) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'contacts array is required' }, 400);
    }

    let imported = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < body.contacts.length; i++) {
      const item = body.contacts[i];
      try {
        // Skip duplicates by email
        if (item.email) {
          const existing = await findContactByEmail(db, tenant.organizationId, item.email);
          if (existing) {
            failed++;
            errors.push({ index: i, error: `Duplicate email: ${item.email}` });
            continue;
          }
        }

        await createContact(db, tenant.organizationId, {
          email: item.email ?? '',
          first_name: item.firstName ?? null,
          last_name: item.lastName ?? null,
          phone: item.phone ?? null,
          custom_fields: item.customFields ?? null,
        });
        imported++;
      } catch (err) {
        failed++;
        errors.push({ index: i, error: String(err) });
      }
    }

    return c.json({ imported, failed, errors: errors.length > 0 ? errors : undefined }, 201);
  } catch (error) {
    console.error('Import contacts error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to import contacts' }, 500);
  }
});

// GET /api/v1/crm/contacts/export - Export contacts
contactRoutes.get('/api/v1/crm/contacts/export', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const format = c.req.query('format') || 'csv';

  try {
    // Fetch all contacts for the org
    const result = await findAllContacts(db, tenant.organizationId, {
      page: 1,
      limit: 10000,
    });

    if (format === 'json') {
      return c.json({ url: '', data: result.data });
    }

    // Generate CSV
    const headers = ['id', 'email', 'first_name', 'last_name', 'phone', 'status', 'created_at'];
    const csvRows = [headers.join(',')];
    for (const contact of result.data) {
      const row = headers.map((h) => {
        const val = (contact as Record<string, unknown>)[h];
        const str = val == null ? '' : String(val);
        // Escape CSV values
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      });
      csvRows.push(row.join(','));
    }

    return new Response(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="contacts.csv"',
      },
    });
  } catch (error) {
    console.error('Export contacts error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to export contacts' }, 500);
  }
});

// POST /api/v1/crm/contacts/merge - Merge two contacts
contactRoutes.post('/api/v1/crm/contacts/merge', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      primaryContactId: string;
      secondaryContactId: string;
    }>();

    if (!body.primaryContactId || !body.secondaryContactId) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'primaryContactId and secondaryContactId are required' },
        400,
      );
    }

    const primary = await findContactById(db, tenant.organizationId, body.primaryContactId);
    if (!primary) {
      return c.json({ code: 'NOT_FOUND', message: 'Primary contact not found' }, 404);
    }

    const secondary = await findContactById(db, tenant.organizationId, body.secondaryContactId);
    if (!secondary) {
      return c.json({ code: 'NOT_FOUND', message: 'Secondary contact not found' }, 404);
    }

    // Merge: fill in blanks on primary from secondary
    const mergedData: Record<string, unknown> = {};
    if (!primary.first_name && secondary.first_name) mergedData.first_name = secondary.first_name;
    if (!primary.last_name && secondary.last_name) mergedData.last_name = secondary.last_name;
    if (!primary.phone && secondary.phone) mergedData.phone = secondary.phone;

    // Merge custom fields
    const primaryFields = (primary.custom_fields ?? {}) as Record<string, unknown>;
    const secondaryFields = (secondary.custom_fields ?? {}) as Record<string, unknown>;
    const mergedFields = { ...secondaryFields, ...primaryFields };
    mergedData.custom_fields = mergedFields;

    // Update primary with merged data
    const merged = await updateContact(db, tenant.organizationId, primary.id, mergedData);

    // Delete secondary
    await deleteContact(db, tenant.organizationId, secondary.id);

    return c.json(merged);
  } catch (error) {
    console.error('Merge contacts error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to merge contacts' }, 500);
  }
});

// GET /api/v1/crm/contacts/:id/activity - Get contact activity
contactRoutes.get('/api/v1/crm/contacts/:id/activity', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    // Verify contact exists and belongs to org
    const contact = await findContactById(db, tenant.organizationId, id);
    if (!contact) {
      return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
    }

    // Activity tracking is handled by the analytics domain
    // Return empty paginated result for now - will be wired to analytics events later
    return c.json({
      data: [],
      total: 0,
      page: pageNum,
      limit: limitNum,
      totalPages: 0,
    });
  } catch (error) {
    console.error('Get contact activity error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get contact activity' }, 500);
  }
});

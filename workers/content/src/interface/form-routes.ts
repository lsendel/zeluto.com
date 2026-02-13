import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findFormById,
  findAllForms,
  createForm,
  updateForm,
  deleteForm,
  createFormSubmission,
  findFormSubmissions,
} from '../infrastructure/repositories/form-repository.js';
import { validateSubmission, renderFormHtml } from '../services/form-processor.js';

export const formRoutes = new Hono<Env>();

// GET /api/v1/content/forms - List forms
formRoutes.get('/api/v1/content/forms', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllForms(db, tenant.organizationId, {
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
    console.error('List forms error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list forms' }, 500);
  }
});

// POST /api/v1/content/forms - Create form
formRoutes.post('/api/v1/content/forms', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      fields: Array<Record<string, unknown>>;
      settings?: Record<string, unknown>;
      redirectUrl?: string;
      isActive?: boolean;
    }>();

    if (!body.name) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'name is required' }, 400);
    }
    if (!body.fields || !Array.isArray(body.fields)) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'fields array is required' }, 400);
    }

    const form = await createForm(db, tenant.organizationId, {
      name: body.name,
      description: body.description ?? null,
      fields: body.fields,
      settings: body.settings ?? null,
      redirectUrl: body.redirectUrl ?? null,
      isActive: body.isActive ?? true,
    });

    return c.json(form, 201);
  } catch (error) {
    console.error('Create form error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create form' }, 500);
  }
});

// GET /api/v1/content/forms/:id - Get form by ID
formRoutes.get('/api/v1/content/forms/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const form = await findFormById(db, tenant.organizationId, id);
    if (!form) {
      return c.json({ code: 'NOT_FOUND', message: 'Form not found' }, 404);
    }
    return c.json(form);
  } catch (error) {
    console.error('Get form error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get form' }, 500);
  }
});

// PATCH /api/v1/content/forms/:id - Update form
formRoutes.patch('/api/v1/content/forms/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      description?: string | null;
      fields?: Array<Record<string, unknown>>;
      settings?: Record<string, unknown>;
      redirectUrl?: string | null;
      isActive?: boolean;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.fields !== undefined) updateData.fields = body.fields;
    if (body.settings !== undefined) updateData.settings = body.settings;
    if (body.redirectUrl !== undefined) updateData.redirectUrl = body.redirectUrl;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const form = await updateForm(db, tenant.organizationId, id, updateData);
    if (!form) {
      return c.json({ code: 'NOT_FOUND', message: 'Form not found' }, 404);
    }

    return c.json(form);
  } catch (error) {
    console.error('Update form error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update form' }, 500);
  }
});

// DELETE /api/v1/content/forms/:id - Delete form
formRoutes.delete('/api/v1/content/forms/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteForm(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Form not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete form error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete form' }, 500);
  }
});

// GET /api/v1/content/forms/:id/render - Render form HTML
formRoutes.get('/api/v1/content/forms/:id/render', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const form = await findFormById(db, tenant.organizationId, id);
    if (!form) {
      return c.json({ code: 'NOT_FOUND', message: 'Form not found' }, 404);
    }

    if (!form.isActive) {
      return c.json({ code: 'FORM_INACTIVE', message: 'This form is no longer active' }, 400);
    }

    const html = renderFormHtml(form);
    return c.html(html);
  } catch (error) {
    console.error('Render form error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to render form' }, 500);
  }
});

// POST /api/v1/content/forms/:id/submit - Process form submission
formRoutes.post('/api/v1/content/forms/:id/submit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const form = await findFormById(db, tenant.organizationId, id);
    if (!form) {
      return c.json({ code: 'NOT_FOUND', message: 'Form not found' }, 404);
    }

    if (!form.isActive) {
      return c.json({ code: 'FORM_INACTIVE', message: 'This form is no longer accepting submissions' }, 400);
    }

    const body = await c.req.json<{ data: Record<string, unknown> }>();
    const submissionData = body.data ?? body;

    // Validate against field definitions
    const validation = validateSubmission(form, submissionData as Record<string, unknown>);
    if (!validation.valid) {
      return c.json({
        code: 'VALIDATION_ERROR',
        message: 'Form validation failed',
        errors: validation.errors,
      }, 400);
    }

    // Store submission
    const submission = await createFormSubmission(db, tenant.organizationId, {
      formId: id,
      data: submissionData,
      contactId: null,
      ipAddress: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
      userAgent: c.req.header('User-Agent') ?? null,
    });

    // Publish FormSubmitted event if queue is available
    try {
      const queue = c.env.EVENTS;
      if (queue) {
        await queue.send({
          type: 'content.FormSubmitted',
          data: {
            organizationId: tenant.organizationId,
            formId: id,
            submissionId: submission.id,
          },
          metadata: {
            id: crypto.randomUUID(),
            version: 1,
            sourceContext: 'content',
            timestamp: new Date().toISOString(),
            correlationId: crypto.randomUUID(),
            tenantContext: { organizationId: tenant.organizationId },
          },
        });
      }
    } catch (err) {
      console.error('Failed to publish FormSubmitted event:', err);
    }

    return c.json({
      success: true,
      redirectUrl: form.redirectUrl ?? undefined,
    });
  } catch (error) {
    console.error('Submit form error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to process submission' }, 500);
  }
});

// GET /api/v1/content/forms/:id/submissions - List form submissions
formRoutes.get('/api/v1/content/forms/:id/submissions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const form = await findFormById(db, tenant.organizationId, id);
    if (!form) {
      return c.json({ code: 'NOT_FOUND', message: 'Form not found' }, 404);
    }

    const result = await findFormSubmissions(db, tenant.organizationId, id, {
      page: pageNum,
      limit: limitNum,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List submissions error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list submissions' }, 500);
  }
});

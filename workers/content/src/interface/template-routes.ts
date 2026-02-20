import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createTemplate,
  deleteTemplate,
  findAllTemplates,
  findTemplateById,
  updateTemplate,
} from '../infrastructure/repositories/template-repository.js';

export const templateRoutes = new Hono<Env>();

// GET /api/v1/content/templates - List templates
templateRoutes.get('/api/v1/content/templates', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllTemplates(db, tenant.organizationId, {
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
    console.error('List templates error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list templates' },
      500,
    );
  }
});

// POST /api/v1/content/templates - Create template
templateRoutes.post('/api/v1/content/templates', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      type: 'email' | 'sms' | 'push' | 'page';
      category?: string;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      bodyJson?: Record<string, unknown>;
      thumbnailUrl?: string;
      isActive?: boolean;
    }>();

    if (!body.name || !body.type) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'name and type are required' },
        400,
      );
    }

    const template = await createTemplate(db, tenant.organizationId, {
      name: body.name,
      type: body.type,
      category: body.category ?? null,
      subject: body.subject ?? null,
      bodyHtml: body.bodyHtml ?? null,
      bodyText: body.bodyText ?? null,
      bodyJson: body.bodyJson ?? null,
      thumbnailUrl: body.thumbnailUrl ?? null,
      isActive: body.isActive ?? true,
      createdBy: tenant.userId,
    });

    return c.json(template, 201);
  } catch (error) {
    console.error('Create template error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create template' },
      500,
    );
  }
});

// GET /api/v1/content/templates/:id - Get template by ID
templateRoutes.get('/api/v1/content/templates/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const template = await findTemplateById(db, tenant.organizationId, id);
    if (!template) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }
    return c.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get template' },
      500,
    );
  }
});

// PATCH /api/v1/content/templates/:id - Update template
templateRoutes.patch('/api/v1/content/templates/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      category?: string | null;
      subject?: string | null;
      bodyHtml?: string | null;
      bodyText?: string | null;
      bodyJson?: Record<string, unknown> | null;
      thumbnailUrl?: string | null;
      isActive?: boolean;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.bodyHtml !== undefined) updateData.bodyHtml = body.bodyHtml;
    if (body.bodyText !== undefined) updateData.bodyText = body.bodyText;
    if (body.bodyJson !== undefined) updateData.bodyJson = body.bodyJson;
    if (body.thumbnailUrl !== undefined)
      updateData.thumbnailUrl = body.thumbnailUrl;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const template = await updateTemplate(
      db,
      tenant.organizationId,
      id,
      updateData,
    );
    if (!template) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }

    return c.json(template);
  } catch (error) {
    console.error('Update template error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update template' },
      500,
    );
  }
});

// DELETE /api/v1/content/templates/:id - Delete template
templateRoutes.delete('/api/v1/content/templates/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteTemplate(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete template' },
      500,
    );
  }
});

// POST /api/v1/content/templates/:id/duplicate - Duplicate template
templateRoutes.post('/api/v1/content/templates/:id/duplicate', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const original = await findTemplateById(db, tenant.organizationId, id);
    if (!original) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }

    const body: { name?: string } = await c.req
      .json<{ name?: string }>()
      .catch(() => ({}));

    const duplicate = await createTemplate(db, tenant.organizationId, {
      name: body.name ?? `${original.name} (Copy)`,
      type: original.type,
      category: original.category,
      subject: original.subject,
      bodyHtml: original.bodyHtml,
      bodyText: original.bodyText,
      bodyJson: original.bodyJson,
      thumbnailUrl: original.thumbnailUrl,
      isActive: false,
      createdBy: tenant.userId,
    });

    return c.json(duplicate, 201);
  } catch (error) {
    console.error('Duplicate template error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to duplicate template' },
      500,
    );
  }
});

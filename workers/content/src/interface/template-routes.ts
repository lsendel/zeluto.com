import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  buildTemplateCompositionPreview,
  deleteTemplateBlockBodyJson,
  upsertTemplateBlockBodyJson,
  upsertTemplateExperimentBodyJson,
} from '../application/template-content-composition.js';
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

// POST /api/v1/content/templates/:id/preview - Render template with blocks/experiments
templateRoutes.post('/api/v1/content/templates/:id/preview', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const template = await findTemplateById(db, tenant.organizationId, id);
    if (!template) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }

    const body: {
      visitorId?: string;
      forcedVariants?: Record<string, string>;
      sharedBlocks?: unknown;
    } = await c.req
      .json<{
        visitorId?: string;
        forcedVariants?: Record<string, string>;
        sharedBlocks?: unknown;
      }>()
      .catch(() => ({}));

    const preview = buildTemplateCompositionPreview({
      templateId: template.id,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      bodyJson: template.bodyJson,
      visitorId: body.visitorId,
      forcedVariants: body.forcedVariants,
      sharedBlocks: body.sharedBlocks,
    });

    return c.json({
      templateId: template.id,
      html: preview.html,
      text: preview.text,
      appliedVariants: preview.appliedVariants,
      blocks: preview.blocks,
      experiments: preview.experiments,
    });
  } catch (error) {
    console.error('Preview template error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to preview template' },
      500,
    );
  }
});

// PUT /api/v1/content/templates/:id/blocks/:key - Upsert reusable block
templateRoutes.put('/api/v1/content/templates/:id/blocks/:key', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const key = c.req.param('key');

  try {
    const body = await c.req.json<{
      html?: string;
      text?: string | null;
    }>();
    if (!body.html || body.html.trim().length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'html is required' },
        400,
      );
    }

    const template = await findTemplateById(db, tenant.organizationId, id);
    if (!template) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }

    const nextBodyJson = upsertTemplateBlockBodyJson(template.bodyJson, {
      key,
      html: body.html,
      text: body.text ?? null,
    });

    const updated = await updateTemplate(db, tenant.organizationId, id, {
      bodyJson: nextBodyJson,
    });
    if (!updated) {
      return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404);
    }

    return c.json(updated);
  } catch (error) {
    console.error('Upsert template block error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to upsert template block' },
      500,
    );
  }
});

// DELETE /api/v1/content/templates/:id/blocks/:key - Remove reusable block
templateRoutes.delete(
  '/api/v1/content/templates/:id/blocks/:key',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');
    const key = c.req.param('key');

    try {
      const template = await findTemplateById(db, tenant.organizationId, id);
      if (!template) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Template not found' },
          404,
        );
      }

      const nextBodyJson = deleteTemplateBlockBodyJson(template.bodyJson, key);
      const updated = await updateTemplate(db, tenant.organizationId, id, {
        bodyJson: nextBodyJson,
      });
      if (!updated) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Template not found' },
          404,
        );
      }

      return c.json(updated);
    } catch (error) {
      console.error('Delete template block error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to delete template block' },
        500,
      );
    }
  },
);

// PUT /api/v1/content/templates/:id/experiments/:key - Upsert experiment variants
templateRoutes.put(
  '/api/v1/content/templates/:id/experiments/:key',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');
    const key = c.req.param('key');

    try {
      const body = await c.req.json<{
        status?: 'draft' | 'active' | 'paused';
        variants?: unknown;
      }>();

      const template = await findTemplateById(db, tenant.organizationId, id);
      if (!template) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Template not found' },
          404,
        );
      }

      const upserted = upsertTemplateExperimentBodyJson(template.bodyJson, {
        key,
        status: body.status,
        variants: body.variants,
      });
      if (!upserted.experiment) {
        return c.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'Experiment variants with positive weight are required',
          },
          400,
        );
      }

      const updated = await updateTemplate(db, tenant.organizationId, id, {
        bodyJson: upserted.bodyJson,
      });
      if (!updated) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Template not found' },
          404,
        );
      }

      return c.json(updated);
    } catch (error) {
      console.error('Upsert template experiment error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to upsert template experiment',
        },
        500,
      );
    }
  },
);

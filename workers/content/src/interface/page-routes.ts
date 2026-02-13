import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findLandingPageById,
  findLandingPageBySlug,
  findAllLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  incrementVisitCount,
} from '../infrastructure/repositories/landing-page-repository.js';
import { sanitizeHtml, wrapInHtmlPage } from '../services/page-renderer.js';

export const pageRoutes = new Hono<Env>();

// GET /api/v1/content/landing-pages - List landing pages
pageRoutes.get('/api/v1/content/landing-pages', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllLandingPages(db, tenant.organizationId, {
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
    console.error('List landing pages error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list landing pages' }, 500);
  }
});

// POST /api/v1/content/landing-pages - Create landing page
pageRoutes.post('/api/v1/content/landing-pages', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      slug: string;
      htmlContent?: string;
      metaDescription?: string;
      templateId?: string;
    }>();

    if (!body.name || !body.slug) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'name and slug are required' }, 400);
    }

    // Sanitize HTML content if provided
    const htmlContent = body.htmlContent ? sanitizeHtml(body.htmlContent) : null;

    const landingPage = await createLandingPage(db, tenant.organizationId, {
      name: body.name,
      slug: body.slug,
      templateId: body.templateId ?? null,
      isPublished: false,
      publishedAt: null,
    });

    return c.json(landingPage, 201);
  } catch (error) {
    console.error('Create landing page error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create landing page' }, 500);
  }
});

// GET /api/v1/content/landing-pages/:id - Get landing page by ID
pageRoutes.get('/api/v1/content/landing-pages/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const landingPage = await findLandingPageById(db, tenant.organizationId, id);
    if (!landingPage) {
      return c.json({ code: 'NOT_FOUND', message: 'Landing page not found' }, 404);
    }
    return c.json(landingPage);
  } catch (error) {
    console.error('Get landing page error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get landing page' }, 500);
  }
});

// PATCH /api/v1/content/landing-pages/:id - Update landing page
pageRoutes.patch('/api/v1/content/landing-pages/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      slug?: string;
      htmlContent?: string | null;
      metaDescription?: string | null;
      templateId?: string | null;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.templateId !== undefined) updateData.templateId = body.templateId;

    const landingPage = await updateLandingPage(db, tenant.organizationId, id, updateData);
    if (!landingPage) {
      return c.json({ code: 'NOT_FOUND', message: 'Landing page not found' }, 404);
    }

    return c.json(landingPage);
  } catch (error) {
    console.error('Update landing page error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update landing page' }, 500);
  }
});

// DELETE /api/v1/content/landing-pages/:id - Delete landing page
pageRoutes.delete('/api/v1/content/landing-pages/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteLandingPage(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Landing page not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete landing page error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete landing page' }, 500);
  }
});

// POST /api/v1/content/landing-pages/:id/publish - Publish landing page
pageRoutes.post('/api/v1/content/landing-pages/:id/publish', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const existing = await findLandingPageById(db, tenant.organizationId, id);
    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Landing page not found' }, 404);
    }

    const landingPage = await updateLandingPage(db, tenant.organizationId, id, {
      isPublished: true,
      publishedAt: new Date(),
    });

    return c.json(landingPage);
  } catch (error) {
    console.error('Publish landing page error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to publish landing page' }, 500);
  }
});

// POST /api/v1/content/landing-pages/:id/unpublish - Unpublish landing page
pageRoutes.post('/api/v1/content/landing-pages/:id/unpublish', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const existing = await findLandingPageById(db, tenant.organizationId, id);
    if (!existing) {
      return c.json({ code: 'NOT_FOUND', message: 'Landing page not found' }, 404);
    }

    const landingPage = await updateLandingPage(db, tenant.organizationId, id, {
      isPublished: false,
    });

    return c.json(landingPage);
  } catch (error) {
    console.error('Unpublish landing page error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to unpublish landing page' }, 500);
  }
});

// GET /p/:slug - Public landing page by slug
pageRoutes.get('/p/:slug', async (c) => {
  const db = c.get('db');
  const slug = c.req.param('slug');

  try {
    const landingPage = await findLandingPageBySlug(db, slug);
    if (!landingPage) {
      return c.json({ code: 'NOT_FOUND', message: 'Page not found' }, 404);
    }

    // Increment visit count in background
    void incrementVisitCount(db, landingPage.id);

    // For now return the page metadata; actual rendering depends on template system
    return c.json({
      html: landingPage.name,
      metadata: {
        title: landingPage.name,
        slug: landingPage.slug,
        visitCount: landingPage.visitCount,
      },
    });
  } catch (error) {
    console.error('Get landing page by slug error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to load page' }, 500);
  }
});

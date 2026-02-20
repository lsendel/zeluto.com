import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findAllAssets } from '../infrastructure/repositories/asset-repository.js';
import {
  findAllForms,
  findFormById,
} from '../infrastructure/repositories/form-repository.js';
import {
  findAllLandingPages,
  findLandingPageById,
} from '../infrastructure/repositories/landing-page-repository.js';
import {
  findAllTemplates,
  findTemplateById,
} from '../infrastructure/repositories/template-repository.js';
import { AssetListView } from '../views/assets/list.js';
import { AssetUploadView } from '../views/assets/upload.js';
import { FormBuilderView } from '../views/forms/builder.js';
import { FormListView } from '../views/forms/list.js';
import { PageEditorView } from '../views/pages/editor.js';
import { PageListView } from '../views/pages/list.js';
import { TemplateFormView } from '../views/templates/form.js';
import { TemplateListView } from '../views/templates/list.js';

/**
 * HTMX view routes for the Content worker.
 * These routes serve HTML fragments loaded via hx-get.
 */
export const viewRoutes = new Hono<Env>();

// ============================================================================
// Template views
// ============================================================================

// GET /app/content/templates - Template list
viewRoutes.get('/app/content/templates', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page: pageStr = '1', limit: limitStr = '25', search } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllTemplates(db, tenant.organizationId, {
      page,
      limit,
      search: search || undefined,
    });

    return c.html(
      <TemplateListView
        templates={result.data}
        total={result.total}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list templates error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load templates. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/content/templates/new - New template form
viewRoutes.get('/app/content/templates/new', (c) => {
  return c.html(<TemplateFormView />);
});

// GET /app/content/templates/:id/edit - Edit template form
viewRoutes.get('/app/content/templates/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const template = await findTemplateById(db, tenant.organizationId, id);
    if (!template) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Template not found.{' '}
          <a
            href="/app/content/templates"
            hx-get="/app/content/templates"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to templates
          </a>
        </div>,
        404,
      );
    }

    return c.html(<TemplateFormView template={template} />);
  } catch (error) {
    console.error('View: edit template error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load template. Please try again.
      </div>,
      500,
    );
  }
});

// ============================================================================
// Form views
// ============================================================================

// GET /app/content/forms - Form list
viewRoutes.get('/app/content/forms', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page: pageStr = '1', limit: limitStr = '25', search } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllForms(db, tenant.organizationId, {
      page,
      limit,
      search: search || undefined,
    });

    return c.html(
      <FormListView
        forms={result.data}
        total={result.total}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list forms error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load forms. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/content/forms/new - New form builder
viewRoutes.get('/app/content/forms/new', (c) => {
  return c.html(<FormBuilderView />);
});

// GET /app/content/forms/:id/edit - Edit form builder
viewRoutes.get('/app/content/forms/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const form = await findFormById(db, tenant.organizationId, id);
    if (!form) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Form not found.{' '}
          <a
            href="/app/content/forms"
            hx-get="/app/content/forms"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to forms
          </a>
        </div>,
        404,
      );
    }

    return c.html(<FormBuilderView form={form} />);
  } catch (error) {
    console.error('View: edit form error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load form. Please try again.
      </div>,
      500,
    );
  }
});

// ============================================================================
// Landing page views
// ============================================================================

// GET /app/content/pages - Page list
viewRoutes.get('/app/content/pages', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page: pageStr = '1', limit: limitStr = '25', search } = c.req.query();

  const pageNum = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllLandingPages(db, tenant.organizationId, {
      page: pageNum,
      limit,
      search: search || undefined,
    });

    return c.html(
      <PageListView
        pages={result.data}
        total={result.total}
        page={pageNum}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list pages error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load landing pages. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/content/pages/new - New page editor
viewRoutes.get('/app/content/pages/new', (c) => {
  return c.html(<PageEditorView />);
});

// GET /app/content/pages/:id/edit - Edit page editor
viewRoutes.get('/app/content/pages/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const landingPage = await findLandingPageById(
      db,
      tenant.organizationId,
      id,
    );
    if (!landingPage) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Landing page not found.{' '}
          <a
            href="/app/content/pages"
            hx-get="/app/content/pages"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to pages
          </a>
        </div>,
        404,
      );
    }

    return c.html(<PageEditorView page={landingPage} />);
  } catch (error) {
    console.error('View: edit page error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load landing page. Please try again.
      </div>,
      500,
    );
  }
});

// ============================================================================
// Asset views
// ============================================================================

// GET /app/content/assets - Asset list
viewRoutes.get('/app/content/assets', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page: pageStr = '1', limit: limitStr = '25', folder } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllAssets(db, tenant.organizationId, {
      page,
      limit,
      folder: folder || undefined,
    });

    return c.html(
      <AssetListView
        assets={result.data}
        total={result.total}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list assets error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load assets. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/content/assets/upload - Upload asset form
viewRoutes.get('/app/content/assets/upload', (c) => {
  return c.html(<AssetUploadView />);
});

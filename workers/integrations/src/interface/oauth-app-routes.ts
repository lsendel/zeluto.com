import { OAuthApp } from '@mauntic/integrations-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  deleteOAuthApp,
  findOAuthAppById,
  findOAuthAppsByOrg,
  findPublishedApps,
  insertOAuthApp,
  updateOAuthApp,
} from '../infrastructure/repositories/oauth-app-repository.js';

export const oauthAppRoutes = new Hono<Env>();

// ── Admin CRUD (requires tenant context) ────────────────

// GET /api/v1/integrations/oauth-apps - List org's OAuth apps
oauthAppRoutes.get('/api/v1/integrations/oauth-apps', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findOAuthAppsByOrg(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
    });

    // Redact client secrets in list response
    const safe = result.data.map((app) => ({
      ...app,
      clientSecret: '••••••••',
    }));

    return c.json({
      data: safe,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List OAuth apps error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list OAuth apps' },
      500,
    );
  }
});

// POST /api/v1/integrations/oauth-apps - Register new OAuth app
oauthAppRoutes.post('/api/v1/integrations/oauth-apps', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      logoUrl?: string;
      redirectUris: string[];
      scopes: string[];
    }>();

    if (!body.name || !body.redirectUris?.length) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'name and at least one redirectUri are required',
        },
        400,
      );
    }

    const app = OAuthApp.create({
      organizationId: tenant.organizationId,
      name: body.name,
      description: body.description,
      logoUrl: body.logoUrl,
      redirectUris: body.redirectUris,
      scopes: body.scopes ?? [],
      createdBy: tenant.userId,
    });

    const props = app.toProps();
    const row = await insertOAuthApp(db, {
      id: props.id,
      organizationId: props.organizationId,
      name: props.name,
      description: props.description,
      logoUrl: props.logoUrl,
      clientId: props.clientId,
      clientSecret: props.clientSecret,
      redirectUris: props.redirectUris,
      scopes: props.scopes,
      isPublished: props.isPublished,
      isVerified: props.isVerified,
      createdBy: props.createdBy,
    });

    // Return full credentials on creation (only time secret is visible)
    return c.json(row, 201);
  } catch (error) {
    console.error('Create OAuth app error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create OAuth app' },
      500,
    );
  }
});

// GET /api/v1/integrations/oauth-apps/:id - Get OAuth app details
oauthAppRoutes.get('/api/v1/integrations/oauth-apps/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const app = await findOAuthAppById(db, id);
    if (!app || app.organizationId !== tenant.organizationId) {
      return c.json(
        { code: 'NOT_FOUND', message: 'OAuth app not found' },
        404,
      );
    }

    return c.json({ ...app, clientSecret: '••••••••' });
  } catch (error) {
    console.error('Get OAuth app error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get OAuth app' },
      500,
    );
  }
});

// PATCH /api/v1/integrations/oauth-apps/:id - Update OAuth app
oauthAppRoutes.patch('/api/v1/integrations/oauth-apps/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      description?: string | null;
      logoUrl?: string | null;
      redirectUris?: string[];
      scopes?: string[];
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.redirectUris !== undefined) updateData.redirectUris = body.redirectUris;
    if (body.scopes !== undefined) updateData.scopes = body.scopes;

    const app = await updateOAuthApp(
      db,
      tenant.organizationId,
      id,
      updateData,
    );
    if (!app) {
      return c.json(
        { code: 'NOT_FOUND', message: 'OAuth app not found' },
        404,
      );
    }

    return c.json({ ...app, clientSecret: '••••••••' });
  } catch (error) {
    console.error('Update OAuth app error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update OAuth app' },
      500,
    );
  }
});

// POST /api/v1/integrations/oauth-apps/:id/rotate-secret - Rotate client secret
oauthAppRoutes.post(
  '/api/v1/integrations/oauth-apps/:id/rotate-secret',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');

    try {
      const existing = await findOAuthAppById(db, id);
      if (!existing || existing.organizationId !== tenant.organizationId) {
        return c.json(
          { code: 'NOT_FOUND', message: 'OAuth app not found' },
          404,
        );
      }

      const app = OAuthApp.reconstitute({
        ...existing,
        redirectUris: existing.redirectUris as string[],
        scopes: existing.scopes as string[],
      });
      const newSecret = app.rotateSecret();

      await updateOAuthApp(db, tenant.organizationId, id, {
        clientSecret: newSecret,
      });

      // Return new secret (only visible once)
      return c.json({ clientSecret: newSecret });
    } catch (error) {
      console.error('Rotate secret error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to rotate secret' },
        500,
      );
    }
  },
);

// POST /api/v1/integrations/oauth-apps/:id/publish - Publish app to marketplace
oauthAppRoutes.post(
  '/api/v1/integrations/oauth-apps/:id/publish',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');

    try {
      const app = await updateOAuthApp(db, tenant.organizationId, id, {
        isPublished: true,
      });
      if (!app) {
        return c.json(
          { code: 'NOT_FOUND', message: 'OAuth app not found' },
          404,
        );
      }
      return c.json({ ...app, clientSecret: '••••••••' });
    } catch (error) {
      console.error('Publish app error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to publish app' },
        500,
      );
    }
  },
);

// POST /api/v1/integrations/oauth-apps/:id/unpublish - Remove from marketplace
oauthAppRoutes.post(
  '/api/v1/integrations/oauth-apps/:id/unpublish',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');

    try {
      const app = await updateOAuthApp(db, tenant.organizationId, id, {
        isPublished: false,
      });
      if (!app) {
        return c.json(
          { code: 'NOT_FOUND', message: 'OAuth app not found' },
          404,
        );
      }
      return c.json({ ...app, clientSecret: '••••••••' });
    } catch (error) {
      console.error('Unpublish app error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to unpublish app' },
        500,
      );
    }
  },
);

// DELETE /api/v1/integrations/oauth-apps/:id - Delete OAuth app
oauthAppRoutes.delete('/api/v1/integrations/oauth-apps/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteOAuthApp(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json(
        { code: 'NOT_FOUND', message: 'OAuth app not found' },
        404,
      );
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete OAuth app error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete OAuth app' },
      500,
    );
  }
});

// ── Public Marketplace ──────────────────────────────────

// GET /api/v1/integrations/marketplace - Browse published apps
oauthAppRoutes.get('/api/v1/integrations/marketplace', async (c) => {
  const db = c.get('db');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findPublishedApps(db, {
      page: pageNum,
      limit: limitNum,
    });

    // Public view: strip secrets and internal fields
    const safe = result.data.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      logoUrl: app.logoUrl,
      scopes: app.scopes,
      isVerified: app.isVerified,
    }));

    return c.json({
      data: safe,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List marketplace apps error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list marketplace apps' },
      500,
    );
  }
});

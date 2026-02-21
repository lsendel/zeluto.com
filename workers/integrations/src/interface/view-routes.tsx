import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findAllConnections,
  findConnectionById,
} from '../infrastructure/repositories/connection-repository.js';
import { findSyncJobsByConnection } from '../infrastructure/repositories/sync-job-repository.js';
import { findAllWebhooks } from '../infrastructure/repositories/webhook-repository.js';
import { ConnectionDetailView } from '../views/connections/detail.js';
import { ConnectionListView } from '../views/connections/list.js';
import { WebhookListView } from '../views/webhooks/list.js';

/**
 * HTMX view routes for the Integrations worker.
 *
 * Route pattern: `/app/integrations/*`
 */
export const viewRoutes = new Hono<Env>();

// GET /app/integrations/connections — Connection list
viewRoutes.get('/app/integrations/connections', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const result = await findAllConnections(db, tenant.organizationId, {
      page: 1,
      limit: 50,
    });
    return c.html(
      <ConnectionListView connections={result.data} total={result.total} />,
    );
  } catch (error) {
    console.error('View: list connections error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load connections. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/integrations/connections/:id — Connection detail with sync history
viewRoutes.get('/app/integrations/connections/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const connection = await findConnectionById(db, tenant.organizationId, id);
    if (!connection) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Connection not found.{' '}
          <a
            href="/app/integrations"
            hx-get="/app/integrations/connections"
            hx-target="#app-content"
            hx-push-url="/app/integrations"
            class="font-medium underline"
          >
            Back to integrations
          </a>
        </div>,
        404,
      );
    }

    const syncResult = await findSyncJobsByConnection(
      db,
      tenant.organizationId,
      id,
      { page: 1, limit: 20 },
    );

    return c.html(
      <ConnectionDetailView
        connection={connection}
        syncJobs={syncResult.data}
      />,
    );
  } catch (error) {
    console.error('View: connection detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load connection. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/integrations/webhooks — Webhook list
viewRoutes.get('/app/integrations/webhooks', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const result = await findAllWebhooks(db, tenant.organizationId, {
      page: 1,
      limit: 50,
    });
    return c.html(
      <WebhookListView webhooks={result.data} total={result.total} />,
    );
  } catch (error) {
    console.error('View: list webhooks error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load webhooks. Please try again.
      </div>,
      500,
    );
  }
});

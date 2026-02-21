import { enrichmentJobs } from '@mauntic/lead-intelligence-domain/drizzle';
import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findProvidersByOrganization } from '../infrastructure/repositories/enrichment-provider-repository.js';
import { EnrichmentJobListView } from '../views/enrichment/jobs.js';
import { ProviderListView } from '../views/provider-list.js';

/**
 * HTMX view routes for the Lead Intelligence worker.
 *
 * Route pattern: `/app/lead-intelligence/*`
 */
export const viewRoutes = new Hono<Env>();

// GET /app/lead-intelligence/providers — Provider list
viewRoutes.get('/app/lead-intelligence/providers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const providers = await findProvidersByOrganization(
      db,
      tenant.organizationId,
    );
    return c.html(<ProviderListView providers={providers} />);
  } catch (error) {
    console.error('View: list providers error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load providers. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/lead-intelligence/jobs — Enrichment job history
viewRoutes.get('/app/lead-intelligence/jobs', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const where = eq(enrichmentJobs.organization_id, tenant.organizationId);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(enrichmentJobs)
        .where(where)
        .orderBy(desc(enrichmentJobs.created_at))
        .limit(50),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(enrichmentJobs)
        .where(where),
    ]);

    return c.html(
      <EnrichmentJobListView
        jobs={rows}
        total={countResult[0]?.count ?? 0}
      />,
    );
  } catch (error) {
    console.error('View: list enrichment jobs error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load enrichment jobs. Please try again.
      </div>,
      500,
    );
  }
});

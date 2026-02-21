import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findDealsByOrganization,
  countDealsByStage,
} from '../infrastructure/repositories/deal-repository.js';
import { findProspectsByOrganization } from '../infrastructure/repositories/prospect-repository.js';
import { DealPipelineView } from '../views/deal-pipeline.js';
import { ProspectListView } from '../views/prospect-list.js';

/**
 * HTMX view routes for the RevOps worker.
 *
 * Route pattern: `/app/revops/*`
 */
export const viewRoutes = new Hono<Env>();

// GET /app/revops/deals — Deal pipeline
viewRoutes.get('/app/revops/deals', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const [dealsResult, stageCounts] = await Promise.all([
      findDealsByOrganization(db, tenant.organizationId, {
        page: 1,
        limit: 200,
      }),
      countDealsByStage(db, tenant.organizationId),
    ]);

    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const s of stageCounts) {
      stageBreakdown[s.stage] = {
        count: s.count,
        value: Number(s.totalValue),
      };
    }

    return c.html(
      <DealPipelineView
        deals={dealsResult.data}
        stageBreakdown={stageBreakdown}
      />,
    );
  } catch (error) {
    console.error('View: deal pipeline error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load deal pipeline. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/revops/prospects — Prospect list
viewRoutes.get('/app/revops/prospects', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const prospects = await findProspectsByOrganization(
      db,
      tenant.organizationId,
    );
    return c.html(<ProspectListView prospects={prospects} />);
  } catch (error) {
    console.error('View: prospect list error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load prospects. Please try again.
      </div>,
      500,
    );
  }
});

import { Campaign } from '@mauntic/campaign-domain';
import { campaigns } from '@mauntic/campaign-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findAbTestsByCampaign,
  findAbTestById,
} from '../infrastructure/repositories/ab-test-repository.js';
import {
  DrizzleCampaignRepository,
  findCampaignStats,
} from '../infrastructure/repositories/campaign-repository.js';
import { AbTestDetailView } from '../views/ab-tests/detail.js';
import { AbTestFormView } from '../views/ab-tests/form.js';
import { AbTestResultsView } from '../views/ab-tests/results.js';
import { CampaignDetailView } from '../views/campaigns/detail.js';
import { CampaignFormView } from '../views/campaigns/form.js';
import { CampaignListView } from '../views/campaigns/list.js';

/**
 * HTMX view routes for the Campaign worker.
 *
 * Route pattern: `/app/campaign/campaigns/*`
 *
 * The Gateway forwards `/app/campaigns/*` requests here after rewriting
 * the path to `/app/campaign/campaigns/*` via `resolveViewPath()`.
 */
export const viewRoutes = new Hono<Env>();

// GET /app/campaign/campaigns — Campaign list (HTML fragment)
viewRoutes.get('/app/campaign/campaigns', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page: pageStr = '1', limit: limitStr = '25', search, status } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const conditions = [eq(campaigns.organizationId, tenant.organizationId)];
    if (status) conditions.push(eq(campaigns.status, status));
    if (search) conditions.push(sql`${campaigns.name} ILIKE ${`%${search}%`}`);
    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(campaigns)
        .where(where)
        .orderBy(desc(campaigns.updatedAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(where),
    ]);

    const data = rows.map((row) =>
      Campaign.reconstitute({
        ...row,
        type: row.type as any,
        status: row.status as any,
        minScore: null,
        maxScore: null,
        grades: null,
      }),
    );

    return c.html(
      <CampaignListView
        campaigns={data}
        total={countResult[0]?.count ?? 0}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list campaigns error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load campaigns. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/campaign/campaigns/new — Create campaign form
viewRoutes.get('/app/campaign/campaigns/new', (c) => {
  return c.html(<CampaignFormView />);
});

// GET /app/campaign/campaigns/:id — Campaign detail
viewRoutes.get('/app/campaign/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const repo = new DrizzleCampaignRepository(db);
    const campaign = await repo.findById(tenant.organizationId, id);
    if (!campaign) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Campaign not found.{' '}
          <a
            href="/app/campaigns"
            hx-get="/app/campaign/campaigns"
            hx-target="#app-content"
            hx-push-url="/app/campaigns"
            class="font-medium underline"
          >
            Back to campaigns
          </a>
        </div>,
        404,
      );
    }

    const [stats, abTests] = await Promise.all([
      findCampaignStats(db, tenant.organizationId, id),
      findAbTestsByCampaign(db, tenant.organizationId, id),
    ]);

    return c.html(
      <CampaignDetailView
        campaign={campaign}
        stats={stats}
        abTests={abTests}
      />,
    );
  } catch (error) {
    console.error('View: campaign detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load campaign. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/campaign/campaigns/:id/edit — Edit campaign form
viewRoutes.get('/app/campaign/campaigns/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const repo = new DrizzleCampaignRepository(db);
    const campaign = await repo.findById(tenant.organizationId, id);
    if (!campaign) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Campaign not found.{' '}
          <a
            href="/app/campaigns"
            hx-get="/app/campaign/campaigns"
            hx-target="#app-content"
            hx-push-url="/app/campaigns"
            class="font-medium underline"
          >
            Back to campaigns
          </a>
        </div>,
        404,
      );
    }

    return c.html(<CampaignFormView campaign={campaign} />);
  } catch (error) {
    console.error('View: edit campaign form error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load campaign form. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/campaign/campaigns/:id/ab/:testId — A/B test detail
viewRoutes.get('/app/campaign/campaigns/:id/ab/:testId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const campaignId = c.req.param('id');
  const testId = c.req.param('testId');

  try {
    const abTest = await findAbTestById(db, tenant.organizationId, testId);
    if (!abTest) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          A/B test not found.{' '}
          <a
            href={`/app/campaigns/${campaignId}`}
            hx-get={`/app/campaign/campaigns/${campaignId}`}
            hx-target="#app-content"
            hx-push-url={`/app/campaigns/${campaignId}`}
            class="font-medium underline"
          >
            Back to campaign
          </a>
        </div>,
        404,
      );
    }

    return c.html(
      <AbTestDetailView abTest={abTest} campaignId={campaignId} />,
    );
  } catch (error) {
    console.error('View: A/B test detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load A/B test. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/campaign/campaigns/:id/ab/new — A/B test builder form
viewRoutes.get('/app/campaign/campaigns/:id/ab/new', (c) => {
  const campaignId = c.req.param('id');
  return c.html(<AbTestFormView campaignId={campaignId} />);
});

// GET /app/campaign/campaigns/:id/ab/:testId/results — A/B test results
viewRoutes.get(
  '/app/campaign/campaigns/:id/ab/:testId/results',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const campaignId = c.req.param('id');
    const testId = c.req.param('testId');

    try {
      const abTest = await findAbTestById(db, tenant.organizationId, testId);
      if (!abTest) {
        return c.html(
          <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
            A/B test not found.{' '}
            <a
              href={`/app/campaigns/${campaignId}`}
              hx-get={`/app/campaign/campaigns/${campaignId}`}
              hx-target="#app-content"
              hx-push-url={`/app/campaigns/${campaignId}`}
              class="font-medium underline"
            >
              Back to campaign
            </a>
          </div>,
          404,
        );
      }

      return c.html(
        <AbTestResultsView abTest={abTest} campaignId={campaignId} />,
      );
    } catch (error) {
      console.error('View: A/B test results error:', error);
      return c.html(
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load A/B test results. Please try again.
        </div>,
        500,
      );
    }
  },
);

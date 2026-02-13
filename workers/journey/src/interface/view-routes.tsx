import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findJourneyById,
  findAllJourneys,
} from '../infrastructure/repositories/journey-repository.js';
import {
  findLatestVersion,
} from '../infrastructure/repositories/version-repository.js';
import {
  findStepsByVersionId,
  findConnectionsByStepIds,
} from '../infrastructure/repositories/step-repository.js';
import {
  findTriggersByJourneyId,
} from '../infrastructure/repositories/trigger-repository.js';
import { JourneyListView } from '../views/journeys/list.js';
import { JourneyDetailView } from '../views/journeys/detail.js';
import { JourneyFormView } from '../views/journeys/form.js';
import { StepAddForm } from '../views/journeys/builder.js';

export const viewRoutes = new Hono<Env>();

// GET /app/journey/journeys - Journey list (HTML fragment)
viewRoutes.get('/app/journey/journeys', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const {
    page: pageStr = '1',
    limit: limitStr = '25',
    search,
    status,
  } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllJourneys(db, tenant.organizationId, {
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
    });

    return c.html(
      <JourneyListView
        journeys={result.data}
        total={result.total}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list journeys error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load journeys. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/journey/journeys/new - Create journey form (HTML fragment)
viewRoutes.get('/app/journey/journeys/new', (c) => {
  return c.html(<JourneyFormView />);
});

// GET /app/journey/journeys/:id - Journey detail/builder view (HTML fragment)
viewRoutes.get('/app/journey/journeys/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const tab = (c.req.query('tab') ?? 'overview') as 'overview' | 'builder' | 'executions';

  try {
    const journey = await findJourneyById(db, tenant.organizationId, id);
    if (!journey) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Journey not found.{' '}
          <a
            href="/app/journey/journeys"
            hx-get="/app/journey/journeys"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to journeys
          </a>
        </div>,
        404,
      );
    }

    const latestVersion = await findLatestVersion(db, tenant.organizationId, id);
    const triggers = await findTriggersByJourneyId(db, tenant.organizationId, id);

    let steps: Awaited<ReturnType<typeof findStepsByVersionId>> = [];
    let connections: Awaited<ReturnType<typeof findConnectionsByStepIds>> = [];
    if (latestVersion) {
      steps = await findStepsByVersionId(db, tenant.organizationId, latestVersion.id);
      const stepIds = steps.map((s) => s.id);
      connections = await findConnectionsByStepIds(db, stepIds);
    }

    return c.html(
      <JourneyDetailView
        journey={journey}
        latestVersion={latestVersion}
        steps={steps}
        connections={connections}
        triggers={triggers}
        activeTab={tab}
      />,
    );
  } catch (error) {
    console.error('View: journey detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load journey. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/journey/journeys/:id/edit - Edit journey form (HTML fragment)
viewRoutes.get('/app/journey/journeys/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const journey = await findJourneyById(db, tenant.organizationId, id);
    if (!journey) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Journey not found.{' '}
          <a
            href="/app/journey/journeys"
            hx-get="/app/journey/journeys"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to journeys
          </a>
        </div>,
        404,
      );
    }

    return c.html(
      <JourneyFormView journey={journey} />,
    );
  } catch (error) {
    console.error('View: edit journey form error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load journey form. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/journey/journeys/:id/add-step - Step add form (HTMX fragment for builder)
viewRoutes.get('/app/journey/journeys/:id/add-step', (c) => {
  const journeyId = c.req.param('id');
  const stepType = c.req.query('type') ?? 'action';

  return c.html(
    <StepAddForm journeyId={journeyId} stepType={stepType} />,
  );
});

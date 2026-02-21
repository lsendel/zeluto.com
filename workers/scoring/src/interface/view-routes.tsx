import { Hono } from 'hono';
import type { Env } from '../app.js';
import { DrizzleSignalAlertRepository } from '../infrastructure/drizzle-signal-alert-repository.js';
import { DrizzleLeadScoreRepository } from '../infrastructure/drizzle-lead-score-repository.js';
import { AlertDashboardView } from '../views/alert-dashboard.js';
import { ScoreDetailView } from '../views/score-detail.js';

/**
 * HTMX view routes for the Scoring worker.
 *
 * Route pattern: `/app/scoring/*`
 */
export const viewRoutes = new Hono<Env>();

// GET /app/scoring/alerts — Alert dashboard
viewRoutes.get('/app/scoring/alerts', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const repo = new DrizzleSignalAlertRepository(db);
    const alerts = await repo.findByOrganization(tenant.organizationId, {});

    return c.html(
      <AlertDashboardView
        alerts={alerts.map((a) => {
          const props = a.toProps();
          return {
            id: props.id,
            contactId: props.contactId,
            signalType: props.signalType,
            priority: props.priority as 'critical' | 'high' | 'medium' | 'low',
            deadline: props.deadline
              ? new Date(props.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '-',
            acknowledged: props.status === 'acknowledged',
          };
        })}
      />,
    );
  } catch (error) {
    console.error('View: alert dashboard error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load alerts. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/scoring/contacts/:id — Score detail for a contact
viewRoutes.get('/app/scoring/contacts/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.param('id');

  try {
    const repo = new DrizzleLeadScoreRepository(db);
    const score = await repo.findByContact(tenant.organizationId, contactId);

    if (!score) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          No score found for this contact.{' '}
          <a
            href="/app/scoring/alerts"
            hx-get="/app/scoring/alerts"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to alerts
          </a>
        </div>,
        404,
      );
    }

    const props = score.toProps();
    return c.html(
      <ScoreDetailView
        contactId={contactId}
        totalScore={props.totalScore}
        grade={props.grade}
        components={props.components as Record<string, number>}
        topContributors={
          (props.topContributors as Array<{
            factor: string;
            points: number;
          }>) ?? []
        }
      />,
    );
  } catch (error) {
    console.error('View: score detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load score. Please try again.
      </div>,
      500,
    );
  }
});

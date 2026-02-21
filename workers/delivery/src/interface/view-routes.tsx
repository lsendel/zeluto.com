import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findAllProviderConfigs, findProviderConfigById } from '../infrastructure/repositories/provider-config-repository.js';
import { findAllSendingDomains, findSendingDomainById } from '../infrastructure/repositories/sending-domain-repository.js';
import { findAllSuppressions } from '../infrastructure/repositories/suppression-repository.js';
import { DomainDetailView } from '../views/domains/detail.js';
import { DomainListView } from '../views/domains/list.js';
import { ProviderFormView } from '../views/providers/form.js';
import { ProviderListView } from '../views/providers/list.js';
import { SuppressionListView } from '../views/suppressions/list.js';

/**
 * HTMX view routes for the Delivery worker.
 *
 * Route pattern: `/app/delivery/*`
 */
export const viewRoutes = new Hono<Env>();

// GET /app/delivery/providers — Provider list
viewRoutes.get('/app/delivery/providers', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const providers = await findAllProviderConfigs(db, tenant.organizationId);
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

// GET /app/delivery/providers/new — Add provider form
viewRoutes.get('/app/delivery/providers/new', (c) => {
  return c.html(<ProviderFormView />);
});

// GET /app/delivery/providers/:id/edit — Edit provider form
viewRoutes.get('/app/delivery/providers/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const provider = await findProviderConfigById(db, tenant.organizationId, id);
    if (!provider) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Provider not found.{' '}
          <a
            href="/app/delivery"
            hx-get="/app/delivery/providers"
            hx-target="#app-content"
            hx-push-url="/app/delivery"
            class="font-medium underline"
          >
            Back to providers
          </a>
        </div>,
        404,
      );
    }

    return c.html(<ProviderFormView provider={provider} />);
  } catch (error) {
    console.error('View: edit provider error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load provider. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/delivery/domains — Domain list
viewRoutes.get('/app/delivery/domains', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const domains = await findAllSendingDomains(db, tenant.organizationId);
    return c.html(<DomainListView domains={domains} />);
  } catch (error) {
    console.error('View: list domains error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load domains. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/delivery/domains/:id — Domain detail with DNS records
viewRoutes.get('/app/delivery/domains/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const domain = await findSendingDomainById(db, tenant.organizationId, id);
    if (!domain) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Domain not found.{' '}
          <a
            href="/app/delivery/domains"
            hx-get="/app/delivery/domains"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to domains
          </a>
        </div>,
        404,
      );
    }

    return c.html(<DomainDetailView domain={domain} />);
  } catch (error) {
    console.error('View: domain detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load domain. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/delivery/suppressions — Suppression list
viewRoutes.get('/app/delivery/suppressions', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page: pageStr = '1', limit: limitStr = '25', reason } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllSuppressions(db, tenant.organizationId, {
      page,
      limit,
      reason: reason || undefined,
    });

    return c.html(
      <SuppressionListView
        suppressions={result.data}
        total={result.total}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list suppressions error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load suppressions. Please try again.
      </div>,
      500,
    );
  }
});

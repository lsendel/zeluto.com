import { AppLayout } from '@mauntic/ui-kit';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { Env } from '../index.js';
import { forwardToService } from '../lib/forward.js';
import { getStaticBaseUrl } from '../utils/static-assets.js';
import { LoginView } from '../views/onboarding/login.js';

export function createPageRoutes() {
  const app = new Hono<Env>();

  // HTMX Application Shell — renders the app chrome with HTMX content loading
  app.get('/app/*', async (c) => {
    const user = c.get('user');
    const organization = c.get('organization');

    if (!user || !organization) {
      return c.redirect('/login');
    }

    const path = c.req.path;
    const isHtmx = c.req.header('HX-Request') === 'true';
    if (isHtmx) {
      return handleHtmxRequest(c, path);
    }

    const assetsBaseUrl = getStaticBaseUrl(c.env);
    const viewPath = resolveViewPath(path);

    return c.html(
      <AppLayout
        title={getPageTitle(path)}
        currentPath={path}
        userName={user.name}
        userEmail={user.email}
        orgName={organization.name}
        assetsBaseUrl={assetsBaseUrl}
      >
        <div
          id="app-content"
          hx-get={viewPath}
          hx-trigger="load"
          hx-swap="innerHTML"
        >
          <div class="flex items-center justify-center py-12">
            <div class="text-gray-500">Loading...</div>
          </div>
        </div>
      </AppLayout>,
    );
  });

  // Login page
  app.get('/login', (c) => {
    const user = c.get('user');
    if (user) {
      const organization = c.get('organization');
      if (!organization) {
        return c.redirect('/app/onboarding/org');
      }
      return c.redirect('/app/dashboard');
    }
    return c.html(<LoginView assetsBaseUrl={getStaticBaseUrl(c.env)} />);
  });

  // Root redirect
  app.get('/', (c) => {
    const user = c.get('user');
    if (user) {
      const organization = c.get('organization');
      if (!organization) {
        return c.redirect('/app/onboarding/org');
      }
      return c.redirect('/app/dashboard');
    }
    return c.redirect('/login');
  });

  return app;
}

function getPageTitle(path: string): string {
  const segment = path.split('/').filter(Boolean)[1];
  if (!segment) return 'Dashboard';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function resolveViewPath(path: string): string {
  if (path.startsWith('/app/contacts')) {
    return path.replace('/app/contacts', '/app/crm/contacts');
  }
  if (path.startsWith('/app/crm') || path.startsWith('/app/contacts')) {
    return path;
  }
  if (path === '/app/content') {
    return '/app/content/templates';
  }
  if (path.startsWith('/app/content/')) {
    return path;
  }
  if (path.startsWith('/app/journeys')) {
    return path.replace('/app/journeys', '/app/journey/journeys');
  }
  return path;
}

async function handleHtmxRequest(
  c: Context<Env>,
  path: string,
): Promise<Response> {
  const service = getViewServiceBinding(c, path);
  if (service) {
    return forwardToService(c, service);
  }
  return renderStubView(c, path);
}

function getViewServiceBinding(c: Context<Env>, path: string): Fetcher | null {
  if (path.startsWith('/app/crm') || path.startsWith('/app/contacts')) {
    return c.env.CRM;
  }
  if (path.startsWith('/app/content')) {
    return c.env.CONTENT;
  }
  if (path.startsWith('/app/journey') || path.startsWith('/app/journeys')) {
    return c.env.JOURNEY;
  }
  return null;
}

function renderStubView(
  c: Context<Env>,
  path: string,
): Response | Promise<Response> {
  if (path.startsWith('/app/dashboard')) {
    return c.html(
      <section class="space-y-6">
        <h1 class="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p class="text-gray-600">
          Welcome to Zeluto. Key metrics and live widgets will appear here as
          soon as the analytics worker finishes rendering the dashboard
          experience.
        </p>
        <div class="grid gap-4 md:grid-cols-3">
          {['Active Journeys', 'Scheduled Campaigns', 'Contacts Synced'].map(
            (label) => (
              <div
                class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                key={label}
              >
                <p class="text-sm text-gray-500">{label}</p>
                <p class="mt-2 text-3xl font-semibold text-gray-900">--</p>
              </div>
            ),
          )}
        </div>
      </section>,
    );
  }

  if (path.startsWith('/app/campaigns')) {
    return c.html(
      <section class="space-y-4">
        <h1 class="text-2xl font-bold text-gray-900">Campaigns</h1>
        <p class="text-gray-600">
          The campaign composer is still migrating to Cloudflare Workers. In the
          meantime, this placeholder confirms the navigation shell works
          end-to-end.
        </p>
      </section>,
    );
  }

  if (path.startsWith('/app/analytics')) {
    return c.html(
      <section class="space-y-6">
        <h1 class="text-2xl font-bold text-gray-900">Analytics Snapshot</h1>
        <div class="grid gap-4 md:grid-cols-2">
          <article class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-medium text-gray-500">Delivery Rate</p>
            <p class="mt-2 text-3xl font-semibold text-gray-900">--%</p>
            <p class="text-sm text-gray-500">
              Delivery metrics will sync automatically.
            </p>
          </article>
          <article class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-medium text-gray-500">Opens</p>
            <p class="mt-2 text-3xl font-semibold text-gray-900">--%</p>
            <p class="text-sm text-gray-500">
              Open/click data will appear here shortly.
            </p>
          </article>
        </div>
        <div class="chart-container rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          Charts will render here once the analytics worker ships the HTMX
          fragments.
        </div>
      </section>,
    );
  }

  if (path.startsWith('/app/settings')) {
    return c.html(
      <section class="space-y-4">
        <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
        <p class="text-gray-600">
          Organization preferences, webhooks, and auth providers will live here.
          The form UI is still wiring up to the billing + identity workers.
        </p>
      </section>,
    );
  }

  if (path.startsWith('/app/billing')) {
    return c.html(
      <section class="space-y-6">
        <h1 class="text-2xl font-bold text-gray-900">Billing</h1>
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-sm text-gray-500">Plan</p>
          <p class="mt-2 text-lg font-semibold text-gray-900">Free (QA)</p>
          <p class="text-sm text-gray-500">Usage</p>
          <p class="mt-1 text-lg font-semibold text-gray-900">
            0 / 5,000 contacts
          </p>
        </div>
      </section>,
    );
  }

  return c.html(
    <section class="space-y-4">
      <h1 class="text-2xl font-bold text-gray-900">Coming Soon</h1>
      <p class="text-gray-600">
        This section does not have HTMX views yet. Navigation is working, and
        the remaining modules will stream their UI fragments once implemented.
      </p>
    </section>,
  );
}

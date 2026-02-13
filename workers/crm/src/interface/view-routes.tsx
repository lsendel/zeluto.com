import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findContactById,
  findAllContacts,
} from '../infrastructure/repositories/contact-repository.js';
import { ContactListView } from '../views/contacts/list.js';
import { ContactDetailView } from '../views/contacts/detail.js';
import { ContactFormView } from '../views/contacts/form.js';

/**
 * HTMX view routes.
 *
 * These routes serve HTML fragments that are loaded into the app shell
 * by the Gateway's HTMX `hx-get` attribute.
 *
 * Route pattern: `/app/crm/contacts/*`
 *
 * The Gateway shell at `/app/*` issues `hx-get="/api/v1{path.replace('/app','')}"`,
 * but the CRM worker can also serve these view routes directly when the Gateway
 * forwards `/app/crm/*` requests.
 */
export const viewRoutes = new Hono<Env>();

// GET /app/crm/contacts - Contact list (HTML fragment)
viewRoutes.get('/app/crm/contacts', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const {
    page: pageStr = '1',
    limit: limitStr = '25',
    search,
  } = c.req.query();

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

  try {
    const result = await findAllContacts(db, tenant.organizationId, {
      page,
      limit,
      search: search || undefined,
    });

    return c.html(
      <ContactListView
        contacts={result.data}
        total={result.total}
        page={page}
        limit={limit}
      />,
    );
  } catch (error) {
    console.error('View: list contacts error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load contacts. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/crm/contacts/new - Create contact form (HTML fragment)
viewRoutes.get('/app/crm/contacts/new', (c) => {
  return c.html(<ContactFormView />);
});

// GET /app/crm/contacts/:id - Contact detail (HTML fragment)
viewRoutes.get('/app/crm/contacts/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');
  const tab = (c.req.query('tab') ?? 'overview') as 'overview' | 'activity' | 'tags';

  try {
    const contact = await findContactById(db, tenant.organizationId, id);
    if (!contact) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Contact not found.{' '}
          <a
            href="/app/crm/contacts"
            hx-get="/app/crm/contacts"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to contacts
          </a>
        </div>,
        404,
      );
    }

    return c.html(
      <ContactDetailView contact={contact} activeTab={tab} />,
    );
  } catch (error) {
    console.error('View: contact detail error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load contact. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/crm/contacts/:id/edit - Edit contact form (HTML fragment)
viewRoutes.get('/app/crm/contacts/:id/edit', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const contact = await findContactById(db, tenant.organizationId, id);
    if (!contact) {
      return c.html(
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          Contact not found.{' '}
          <a
            href="/app/crm/contacts"
            hx-get="/app/crm/contacts"
            hx-target="#app-content"
            hx-push-url="true"
            class="font-medium underline"
          >
            Back to contacts
          </a>
        </div>,
        404,
      );
    }

    return c.html(
      <ContactFormView contact={contact} />,
    );
  } catch (error) {
    console.error('View: edit contact form error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load contact form. Please try again.
      </div>,
      500,
    );
  }
});

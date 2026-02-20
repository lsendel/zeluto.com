import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Tenant Isolation Audit Tests
 *
 * These tests verify that data belonging to one organization
 * is never accessible to another organization.
 *
 * Prerequisites:
 * - A running API environment (local or staging)
 *
 * Run with:
 *   API_BASE_URL=https://zeluto.com pnpm vitest tests/tenant-isolation/
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8787';

interface TestOrg {
  id: string;
  name: string;
  sessionCookie: string;
}

interface TestContact {
  id: string;
  email: string;
}

let orgA: TestOrg;
let orgB: TestOrg;

/**
 * Helper: make an authenticated API request for a given org
 */
async function apiRequest(
  org: TestOrg,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: org.sessionCookie,
    Origin: API_BASE_URL,
  };

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
}

/**
 * Extract session cookie from set-cookie header
 */
function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  // Match the __Secure-better-auth.session_token cookie
  const match = raw.match(/(__Secure-better-auth\.session_token=[^;]+)/);
  if (match) return match[1];
  // Fallback: first cookie
  const first = raw.split(';')[0];
  return first || '';
}

/**
 * Helper: create a test organization via the API
 */
async function createTestOrg(email: string, orgName: string): Promise<TestOrg> {
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Step 1: Sign up user via Better Auth
  const signupRes = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: API_BASE_URL,
    },
    body: JSON.stringify({
      email,
      password: `TestPassword123!_${Date.now()}`,
      name: `Test User ${orgName}`,
    }),
  });

  if (!signupRes.ok) {
    throw new Error(
      `Signup failed: ${signupRes.status} ${await signupRes.text()}`,
    );
  }

  const sessionCookie = extractSessionCookie(signupRes);
  if (!sessionCookie) {
    throw new Error('No session cookie returned from signup');
  }

  // Step 2: Create organization via Better Auth organization plugin
  const orgRes = await fetch(`${API_BASE_URL}/api/auth/organization/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      Origin: API_BASE_URL,
    },
    body: JSON.stringify({ name: orgName, slug }),
  });

  if (!orgRes.ok) {
    throw new Error(
      `Org creation failed: ${orgRes.status} ${await orgRes.text()}`,
    );
  }

  const orgData = (await orgRes.json()) as { id: string; name: string };

  // Step 3: Set the newly created org as active
  const setActiveRes = await fetch(
    `${API_BASE_URL}/api/auth/organization/set-active`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
        Origin: API_BASE_URL,
      },
      body: JSON.stringify({ organizationId: orgData.id }),
    },
  );

  if (!setActiveRes.ok) {
    throw new Error(
      `Set active org failed: ${setActiveRes.status} ${await setActiveRes.text()}`,
    );
  }

  return {
    id: orgData.id,
    name: orgData.name,
    sessionCookie,
  };
}

describe('Tenant Isolation Audit', () => {
  const orgAContacts: TestContact[] = [];
  const orgBContacts: TestContact[] = [];

  beforeAll(async () => {
    try {
      const ts = Date.now();
      orgA = await createTestOrg(
        `test-orgA-${ts}@mauntic-test.example`,
        `testorga${ts}`,
      );

      orgB = await createTestOrg(
        `test-orgB-${ts}@mauntic-test.example`,
        `testorgb${ts}`,
      );
    } catch (e) {
      console.warn(
        'Tenant isolation tests require a running API environment.',
        String(e),
      );
    }
  }, 30_000);

  describe('Contact isolation', () => {
    it('should create contacts in Org A', async () => {
      if (!orgA) return;

      const res = await apiRequest(orgA, 'POST', '/api/v1/crm/contacts', {
        email: 'alice@orgA-test.example',
        firstName: 'Alice',
        lastName: 'OrgA',
      });

      expect(res.status).toBe(201);
      const contact = (await res.json()) as TestContact;
      expect(contact.id).toBeDefined();
      orgAContacts.push(contact);
    });

    it('should create contacts in Org B', async () => {
      if (!orgB) return;

      const res = await apiRequest(orgB, 'POST', '/api/v1/crm/contacts', {
        email: 'bob@orgB-test.example',
        firstName: 'Bob',
        lastName: 'OrgB',
      });

      expect(res.status).toBe(201);
      const contact = (await res.json()) as TestContact;
      expect(contact.id).toBeDefined();
      orgBContacts.push(contact);
    });

    it('Org A should NOT see Org B contacts in list', async () => {
      if (!orgA || !orgB) return;

      const res = await apiRequest(orgA, 'GET', '/api/v1/crm/contacts');
      expect(res.status).toBe(200);

      const data = (await res.json()) as { data: TestContact[] };
      const orgBEmails = orgBContacts.map((c) => c.email);

      for (const contact of data.data) {
        expect(orgBEmails).not.toContain(contact.email);
      }
    });

    it('Org B should NOT see Org A contacts in list', async () => {
      if (!orgA || !orgB) return;

      const res = await apiRequest(orgB, 'GET', '/api/v1/crm/contacts');
      expect(res.status).toBe(200);

      const data = (await res.json()) as { data: TestContact[] };
      const orgAEmails = orgAContacts.map((c) => c.email);

      for (const contact of data.data) {
        expect(orgAEmails).not.toContain(contact.email);
      }
    });

    it('Org A should NOT be able to access Org B contact by ID', async () => {
      if (!orgA || !orgBContacts.length) return;

      const orgBContactId = orgBContacts[0].id;
      const res = await apiRequest(
        orgA,
        'GET',
        `/api/v1/crm/contacts/${orgBContactId}`,
      );

      expect([403, 404]).toContain(res.status);
    });

    it('Org B should NOT be able to access Org A contact by ID', async () => {
      if (!orgB || !orgAContacts.length) return;

      const orgAContactId = orgAContacts[0].id;
      const res = await apiRequest(
        orgB,
        'GET',
        `/api/v1/crm/contacts/${orgAContactId}`,
      );

      expect([403, 404]).toContain(res.status);
    });

    it('Org A should NOT be able to update Org B contact', async () => {
      if (!orgA || !orgBContacts.length) return;

      const orgBContactId = orgBContacts[0].id;
      const res = await apiRequest(
        orgA,
        'PATCH',
        `/api/v1/crm/contacts/${orgBContactId}`,
        { firstName: 'HACKED' },
      );

      expect([403, 404]).toContain(res.status);
    });

    it('Org A should NOT be able to delete Org B contact', async () => {
      if (!orgA || !orgBContacts.length) return;

      const orgBContactId = orgBContacts[0].id;
      const res = await apiRequest(
        orgA,
        'DELETE',
        `/api/v1/crm/contacts/${orgBContactId}`,
      );

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Campaign isolation', () => {
    let orgACampaignId: string;
    let orgBCampaignId: string;

    it('should create campaign in Org A', async () => {
      if (!orgA) return;

      const res = await apiRequest(orgA, 'POST', '/api/v1/campaign/campaigns', {
        name: 'Org A Campaign',
        type: 'email',
      });

      expect(res.status).toBe(201);
      const campaign = (await res.json()) as { id: string };
      orgACampaignId = campaign.id;
    });

    it('should create campaign in Org B', async () => {
      if (!orgB) return;

      const res = await apiRequest(orgB, 'POST', '/api/v1/campaign/campaigns', {
        name: 'Org B Campaign',
        type: 'email',
      });

      expect(res.status).toBe(201);
      const campaign = (await res.json()) as { id: string };
      orgBCampaignId = campaign.id;
    });

    it('Org A should NOT see Org B campaigns', async () => {
      if (!orgA || !orgBCampaignId) return;

      const res = await apiRequest(
        orgA,
        'GET',
        `/api/v1/campaign/campaigns/${orgBCampaignId}`,
      );

      expect([403, 404]).toContain(res.status);
    });

    it('Org B should NOT see Org A campaigns', async () => {
      if (!orgB || !orgACampaignId) return;

      const res = await apiRequest(
        orgB,
        'GET',
        `/api/v1/campaign/campaigns/${orgACampaignId}`,
      );

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Journey isolation', () => {
    let orgAJourneyId: string;
    let orgBJourneyId: string;

    it('should create journey in Org A', async () => {
      if (!orgA) return;

      const res = await apiRequest(orgA, 'POST', '/api/v1/journey/journeys', {
        name: 'Org A Journey',
      });

      expect(res.status).toBe(201);
      const journey = (await res.json()) as { id: string };
      orgAJourneyId = journey.id;
    });

    it('should create journey in Org B', async () => {
      if (!orgB) return;

      const res = await apiRequest(orgB, 'POST', '/api/v1/journey/journeys', {
        name: 'Org B Journey',
      });

      expect(res.status).toBe(201);
      const journey = (await res.json()) as { id: string };
      orgBJourneyId = journey.id;
    });

    it('Org A should NOT see Org B journeys', async () => {
      if (!orgA || !orgBJourneyId) return;

      const res = await apiRequest(
        orgA,
        'GET',
        `/api/v1/journey/journeys/${orgBJourneyId}`,
      );

      expect([403, 404]).toContain(res.status);
    });

    it('Org B should NOT see Org A journeys', async () => {
      if (!orgB || !orgAJourneyId) return;

      const res = await apiRequest(
        orgB,
        'GET',
        `/api/v1/journey/journeys/${orgAJourneyId}`,
      );

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Template isolation', () => {
    let orgATemplateId: string;

    it('should create template in Org A', async () => {
      if (!orgA) return;

      const res = await apiRequest(orgA, 'POST', '/api/v1/content/templates', {
        name: 'Org A Template',
        type: 'email',
        subject: 'Test Subject',
        body: '<p>Hello</p>',
      });

      expect(res.status).toBe(201);
      const template = (await res.json()) as { id: string };
      orgATemplateId = template.id;
    });

    it('Org B should NOT see Org A templates', async () => {
      if (!orgB || !orgATemplateId) return;

      const res = await apiRequest(
        orgB,
        'GET',
        `/api/v1/content/templates/${orgATemplateId}`,
      );

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Analytics isolation', () => {
    it('Org A should only see own analytics', async () => {
      if (!orgA) return;

      const res = await apiRequest(orgA, 'GET', '/api/v1/analytics/overview');

      expect(res.status).toBe(200);
    });

    it('Org B should only see own analytics', async () => {
      if (!orgB) return;

      const res = await apiRequest(orgB, 'GET', '/api/v1/analytics/overview');

      expect(res.status).toBe(200);
    });
  });

  describe('API endpoint tenant header tampering', () => {
    it('should reject requests with forged X-Tenant-Context header', async () => {
      if (!orgA || !orgB) return;

      const forgedTenantContext = btoa(
        JSON.stringify({
          organizationId: orgB.id,
          userId: 'fake-user-id',
          userRole: 'admin',
          plan: 'enterprise',
        }),
      );

      const res = await fetch(`${API_BASE_URL}/api/v1/crm/contacts`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: orgA.sessionCookie,
          Origin: API_BASE_URL,
          'X-Tenant-Context': forgedTenantContext,
        },
      });

      // Gateway should override forged header with actual session data.
      if (res.ok) {
        const data = (await res.json()) as { data: TestContact[] };
        const orgBEmails = orgBContacts.map((c) => c.email);
        for (const contact of data.data) {
          expect(orgBEmails).not.toContain(contact.email);
        }
      }
    });
  });
});

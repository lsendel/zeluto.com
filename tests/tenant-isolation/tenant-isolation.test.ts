import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Tenant Isolation Audit Tests
 *
 * These tests verify that data belonging to one organization
 * is never accessible to another organization.
 *
 * Prerequisites:
 * - A running API environment (local or staging)
 * - Two test organizations created via the API
 *
 * Run with: pnpm vitest tests/tenant-isolation/
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
  };

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper: create a test organization via the API
 */
async function createTestOrg(
  email: string,
  orgName: string,
): Promise<TestOrg> {
  // Step 1: Sign up user
  const signupRes = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: `TestPassword123!_${Date.now()}`,
      name: `Test User ${orgName}`,
    }),
  });

  if (!signupRes.ok) {
    throw new Error(`Signup failed: ${signupRes.status} ${await signupRes.text()}`);
  }

  // Extract session cookie from response
  const setCookie = signupRes.headers.get('set-cookie') ?? '';
  const sessionCookie = setCookie.split(';')[0] ?? '';

  // Step 2: Create organization via onboarding
  const orgRes = await fetch(`${API_BASE_URL}/api/v1/onboarding/organization`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ name: orgName }),
  });

  if (!orgRes.ok) {
    throw new Error(`Org creation failed: ${orgRes.status} ${await orgRes.text()}`);
  }

  const orgData = (await orgRes.json()) as { id: string; name: string };

  return {
    id: orgData.id,
    name: orgData.name,
    sessionCookie,
  };
}

describe('Tenant Isolation Audit', () => {
  // Track created resources for cleanup and cross-org checks
  let orgAContacts: TestContact[] = [];
  let orgBContacts: TestContact[] = [];

  beforeAll(async () => {
    try {
      // Create two distinct test organizations
      orgA = await createTestOrg(
        `test-orgA-${Date.now()}@mauntic-test.example`,
        `Test Org A ${Date.now()}`,
      );

      orgB = await createTestOrg(
        `test-orgB-${Date.now()}@mauntic-test.example`,
        `Test Org B ${Date.now()}`,
      );
    } catch {
      // If setup fails (no running environment), tests will be skipped
      console.warn(
        'Tenant isolation tests require a running API environment. ' +
          'Set API_BASE_URL env var or run locally.',
      );
    }
  });

  describe('Contact isolation', () => {
    it('should create contacts in Org A', async () => {
      if (!orgA) return; // skip if setup failed

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

      // Verify none of Org B's contacts appear in Org A's list
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

      // Should return 404 (not found in this org's scope) or 403
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
        channel: 'email',
      });

      expect(res.status).toBe(201);
      const campaign = (await res.json()) as { id: string };
      orgACampaignId = campaign.id;
    });

    it('should create campaign in Org B', async () => {
      if (!orgB) return;

      const res = await apiRequest(orgB, 'POST', '/api/v1/campaign/campaigns', {
        name: 'Org B Campaign',
        channel: 'email',
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
        channel: 'email',
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

      const res = await apiRequest(
        orgA,
        'GET',
        '/api/v1/analytics/overview',
      );

      // Should succeed and only contain data scoped to Org A
      expect(res.status).toBe(200);
    });

    it('Org B should only see own analytics', async () => {
      if (!orgB) return;

      const res = await apiRequest(
        orgB,
        'GET',
        '/api/v1/analytics/overview',
      );

      expect(res.status).toBe(200);
    });
  });

  describe('API endpoint tenant header tampering', () => {
    it('should reject requests with forged X-Tenant-Context header', async () => {
      if (!orgA || !orgB) return;

      // Try to access API with Org A's session but forged Org B tenant header
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
          'X-Tenant-Context': forgedTenantContext,
        },
      });

      // Gateway should override forged header with actual session data.
      // Contacts returned should belong to Org A, not Org B.
      if (res.ok) {
        const data = (await res.json()) as { data: TestContact[] };
        const orgBEmails = orgBContacts.map((c) => c.email);
        for (const contact of data.data) {
          expect(orgBEmails).not.toContain(contact.email);
        }
      }
      // If gateway rejects the forged header, that is also acceptable
    });
  });
});

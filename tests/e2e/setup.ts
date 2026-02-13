/**
 * E2E Test Environment Setup
 *
 * This module runs before each test file and provides helper functions
 * for creating test organizations, users, and making authenticated requests.
 *
 * Required environment variables:
 *   - E2E_BASE_URL: The base URL of the gateway worker (e.g. http://localhost:8787)
 *   - E2E_DATABASE_URL: Database connection string (optional, for direct DB verification)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8787';
export const DATABASE_URL = process.env.E2E_DATABASE_URL ?? '';

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

let testCounter = 0;

export function uniqueEmail(): string {
  return `e2e-test-${Date.now()}-${++testCounter}@test.mauntic.local`;
}

export function uniqueName(prefix = 'E2E Test'): string {
  return `${prefix} ${Date.now()}-${++testCounter}`;
}

export function uniqueSlug(): string {
  return `e2e-test-${Date.now()}-${++testCounter}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: T; headers: Headers }> {
  const { method = 'GET', body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseBody = (await response.json().catch(() => null)) as T;

  return {
    status: response.status,
    body: responseBody,
    headers: response.headers,
  };
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export interface TestOrganization {
  id: string;
  name: string;
  slug: string;
}

/**
 * Create a test user via the signup endpoint.
 *
 * TODO: Implement once the identity worker is running in the test environment.
 */
export async function createTestUser(
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const name = overrides.name ?? uniqueName('Test User');
  const password = overrides.password ?? 'TestPassword123!';

  // TODO: Call POST /api/v1/auth/signup and return user + token
  // const { status, body } = await apiRequest('/api/v1/auth/signup', {
  //   method: 'POST',
  //   body: { email, name, password },
  // });
  // expect(status).toBe(201);
  // return { id: body.user.id, email, name, token: body.token };

  // Placeholder - return mock until services are available
  return {
    id: crypto.randomUUID(),
    email,
    name,
    token: 'mock-token',
  };
}

/**
 * Create a test organization.
 *
 * TODO: Implement once the identity worker is running.
 */
export async function createTestOrganization(
  token: string,
  overrides: Partial<{ name: string; slug: string }> = {},
): Promise<TestOrganization> {
  const name = overrides.name ?? uniqueName('Test Org');
  const slug = overrides.slug ?? uniqueSlug();

  // TODO: Call POST /api/v1/organizations and return org
  // const { status, body } = await apiRequest('/api/v1/organizations', {
  //   method: 'POST',
  //   body: { name, slug },
  //   token,
  // });
  // expect(status).toBe(201);
  // return { id: body.id, name, slug };

  return {
    id: crypto.randomUUID(),
    name,
    slug,
  };
}

/**
 * Login as an existing test user.
 *
 * TODO: Implement once the identity worker is running.
 */
export async function loginTestUser(
  email: string,
  password: string,
): Promise<{ token: string }> {
  // TODO: Call POST /api/v1/auth/login
  // const { status, body } = await apiRequest('/api/v1/auth/login', {
  //   method: 'POST',
  //   body: { email, password },
  // });
  // expect(status).toBe(200);
  // return { token: body.token };

  return { token: 'mock-token' };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const cleanupFns: (() => Promise<void>)[] = [];

export function onCleanup(fn: () => Promise<void>): void {
  cleanupFns.push(fn);
}

afterAll(async () => {
  // Run all registered cleanup functions
  for (const fn of cleanupFns.reverse()) {
    try {
      await fn();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
  cleanupFns.length = 0;
});

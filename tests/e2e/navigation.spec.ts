import { test, expect } from '@playwright/test';

test.describe('Navigation & Infrastructure', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('login page renders HTML', async ({ request }) => {
    const response = await request.get('/login');
    expect(response.ok()).toBeTruthy();
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/html');
  });

  test('root redirects authenticated or to login', async ({ page }) => {
    await page.goto('/');
    // Without session, should redirect to login
    const url = page.url();
    expect(url).toMatch(/login|dashboard/);
  });

  test('unknown API routes return appropriate status', async ({ request }) => {
    const response = await request.get('/api/v1/nonexistent');
    // Either 401 (auth required) or 404 (not found)
    expect([401, 404]).toContain(response.status());
  });
});

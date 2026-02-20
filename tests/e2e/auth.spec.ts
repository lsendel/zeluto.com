import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated API request returns 401', async ({ request }) => {
    const response = await request.get('/api/v1/me');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/app/signup');
    await expect(page).toHaveURL(/signup/);
    await expect(page.locator('body')).toBeVisible();
  });
});

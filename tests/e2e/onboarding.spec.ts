import { expect, test } from '@playwright/test';

test.describe('Onboarding', () => {
  test('unauthenticated onboarding redirects to login', async ({ page }) => {
    await page.goto('/app/onboarding/org');
    // Without a valid session, should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('onboarding API returns 401 without session', async ({ request }) => {
    const response = await request.get('/api/v1/onboarding/status');
    expect(response.status()).toBe(401);
  });
});

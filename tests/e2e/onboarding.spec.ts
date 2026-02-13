import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should allow a user to sign up and create an organization', async ({ page }) => {
    // 1. Go to signup page
    await page.goto('/app/signup');
    await expect(page).toHaveTitle(/Signup/);

    // 2. Fill in signup form
    // Note: These selectors depend on the actual SignupView implementation
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 3. Should be redirected to create organization
    await expect(page).toHaveURL(/\/app\/onboarding\/org/);
    await expect(page.locator('h1')).toContainText(/Create your organization/i);

    // 4. Fill in organization form
    await page.fill('input[name="name"]', 'My Test Org');
    // Slug should be auto-generated or manual
    await page.fill('input[name="slug"]', `test-org-${Date.now()}`);
    await page.click('button[type="submit"]');

    // 5. Should be redirected to plan selection
    await expect(page).toHaveURL(/\/app\/onboarding\/plan/);
    await expect(page.locator('h1')).toContainText(/Select a plan/i);

    // 6. Select free plan
    await page.click('button:has-text("Select Free")');

    // 7. Should be redirected to setup
    await expect(page).toHaveURL(/\/app\/onboarding\/setup/);
    await expect(page.locator('h1')).toContainText(/Setup your account/i);

    // 8. Skip setup for now
    await page.click('button:has-text("Skip")');

    // 9. Should be redirected to dashboard
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.locator('h1')).toContainText(/Dashboard/i);
  });
});

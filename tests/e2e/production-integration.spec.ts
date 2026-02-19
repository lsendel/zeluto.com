import { test, expect } from '@playwright/test';

/**
 * Production Integration Tests for Mauntic
 *
 * Configure environment variables before running:
 * - PRODUCTION_E2E_BASE_URL
 * - PRODUCTION_E2E_ADMIN_EMAIL
 * - PRODUCTION_E2E_ADMIN_PASSWORD
 */

const BASE_URL = process.env.PRODUCTION_E2E_BASE_URL;
const ADMIN_EMAIL = process.env.PRODUCTION_E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PRODUCTION_E2E_ADMIN_PASSWORD;

if (BASE_URL) {
  test.use({ baseURL: BASE_URL });
}

const describeSuite =
  BASE_URL && ADMIN_EMAIL && ADMIN_PASSWORD ? test.describe : test.describe.skip;

describeSuite('Mauntic Production Workflows', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Authentication Flow
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sign In | Mauntic/);

    await page.getByLabel(/Email address/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/Password/i).fill(ADMIN_PASSWORD!);
    
    // Submit and wait for navigation
    await Promise.all([
      page.waitForURL(/\/app\/dashboard/),
      page.getByRole('button', { name: /Sign in/i }).click(),
    ]);

    // Ensure dashboard content is loaded (not stuck on loading state)
    await expect(page.locator('#main-content')).not.toContainText('Loading...');
  });

  test('Workflow 1: CRM & Audience Management', async ({ page }) => {
    // Navigate to CRM
    await page.getByRole('link', { name: /Contacts/i }).click();
    await expect(page).toHaveURL(/\/app\/contacts/);
    
    // Click New Contact
    await page.getByRole('link', { name: /New/i }).first().click();
    await expect(page).toHaveURL(/\/app\/contacts\/new/);

    // Fill form
    const uniqueEmail = `integration-${Date.now()}@zeluto.com`;
    await page.getByLabel(/Email/i).fill(uniqueEmail);
    await page.getByLabel(/First Name/i).fill('Integration');
    await page.getByLabel(/Last Name/i).fill('Test');
    await page.getByLabel(/Phone/i).fill('+15551234567');

    // Save
    await page.getByRole('button', { name: /Create Contact/i }).click();

    // Verify detail page load
    await expect(page.locator('#main-content')).toContainText('Integration Test');
    await expect(page.locator('#main-content')).toContainText(uniqueEmail);

    // Verify in list via search
    await page.getByRole('link', { name: /Contacts/i }).click();
    await page.getByPlaceholder(/Search/i).fill(uniqueEmail);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('table')).toContainText(uniqueEmail);
  });

  test('Workflow 2: Marketing Content & Campaigns', async ({ page }) => {
    // 1. Content Templates
    await page.getByRole('link', { name: /Content/i }).click();
    await expect(page).toHaveURL(/\/app\/content/);
    await expect(page.locator('#main-content')).toContainText(/Templates/i);

    // 2. Campaigns
    await page.getByRole('link', { name: /Campaigns/i }).click();
    await expect(page).toHaveURL(/\/app\/campaigns/);
    // Should see campaign list or empty state
    await expect(page.locator('#main-content')).toBeVisible();

    // 3. Journeys (Automation)
    await page.getByRole('link', { name: /Journeys/i }).click();
    await expect(page).toHaveURL(/\/app\/journeys/);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('Workflow 3: Analytics & Insights', async ({ page }) => {
    await page.getByRole('link', { name: /Analytics/i }).click();
    await expect(page).toHaveURL(/\/app\/analytics/);
    
    // Look for some charts or stats
    await expect(page.locator('canvas, .recharts-surface, .chart-container').first()).toBeVisible();
    await expect(page.locator('#main-content')).toContainText(/Delivery/i);
    await expect(page.locator('#main-content')).toContainText(/Opens/i);
  });

  test('Workflow 4: Account & Organization Settings', async ({ page }) => {
    // 1. General Settings
    await page.getByRole('link', { name: /Settings/i }).click();
    await expect(page).toHaveURL(/\/app\/settings/);
    await expect(page.locator('h1')).toContainText(/Settings/i);

    // 2. Billing & Subscription
    await page.getByRole('link', { name: /Billing/i }).click();
    await expect(page).toHaveURL(/\/app\/billing/);
    await expect(page.locator('#main-content')).toContainText(/Plan/i);
    await expect(page.locator('#main-content')).toContainText(/Usage/i);
  });

  test('Workflow 5: Multi-tenant / Org Switcher', async ({ page }) => {
    // Open org switcher
    await page.getByRole('button', { name: /zeluto/i }).click();
    
    // Verify modal appears
    await expect(page.locator('#modal-container')).toBeVisible();
    await expect(page.locator('#modal-container')).toContainText(/Switch Organization/i);
    
    // Close modal (assuming there's a close button or backdrop)
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal-container')).not.toBeVisible();
  });
});

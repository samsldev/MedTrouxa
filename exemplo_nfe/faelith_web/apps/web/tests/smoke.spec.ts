/**
 * @fileoverview Playwright smoke coverage for public navigation and key copy.
 * @author Samuel S. L.
 * @version 1.3.3
 * @since 2026-09-06
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * DETAILED_DESCRIPTION:
 * - Asserts public nav labels on the home page
 * - Checks Starter and generic usage copy on pricing, and the curl installer on download
 * - Confirms GitHub and Google links on the login page
 * - Mocks session APIs to assert the six dashboard sidebar items
 */

import { expect, test } from '@playwright/test';

test('public nav links are visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Models' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Products' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pricing' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resources' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download' }).first()).toBeVisible();
  await expect(page.getByText('ZDR inference provider').first()).toBeVisible();
});

test('/pricing has Starter and generous usage copy', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Starter', { exact: true })).toBeVisible();
  await expect(page.getByText('Generous Code/CLI usage, sized to this plan').first()).toBeVisible();
  await expect(page.getByText('Chat shares the Code/CLI 5-hour, weekly, and monthly pool').first()).toBeVisible();
});

test('/download has curl', async ({ page }) => {
  await page.goto('/download');
  await expect(page.getByText('curl -fsSL https://get.faelithindustries.com | sh')).toBeVisible();
});

test('login page has GitHub and Google', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google' })).toBeVisible();
});

test('unauthenticated /app redirects to login', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
});

test('authenticated dashboard shows six sidebar items', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'ada@example.com',
        name: 'Ada',
        plan: 'starter',
        usage_based: false,
        githubLinked: false,
        googleLinked: false,
      }),
    });
  });
  await page.route('**/api/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plan: 'starter',
        usage_based: false,
        usage: {
          code_5h: { used: 0, limit: 1 },
          code_weekly: { used: 0, limit: 1 },
          chat_5h: { used: 0, limit: 1 },
          chat_weekly: { used: 0, limit: 1 },
          chat_monthly: { used: 0, limit: 1 },
        },
        heatmap: [],
      }),
    });
  });
  await page.goto('/app');
  await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'API Keys', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usage', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spending', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Billing & Invoices', exact: true })).toBeVisible();
});

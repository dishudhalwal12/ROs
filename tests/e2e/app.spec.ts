import { expect, test } from '@playwright/test';

test('login screen renders the workspace onboarding', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /Rovexa Team OS/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('protected routes redirect signed-out users to login', async ({ page }) => {
  await page.goto('/tasks');

  await expect(page).toHaveURL(/\/login/);
});

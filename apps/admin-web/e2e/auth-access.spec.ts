import { expect, test, type Page } from '@playwright/test';

const password = 'test-password';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('admin access', () => {
  test('redirects an anonymous protected request to login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('allows a seeded active admin to load the dashboard', async ({ page }) => {
    await signIn(page, 'admin@altitutor.test');

    await expect(page).toHaveURL(/\/dashboard\/\d{4}-\d{2}-\d{2}$/, {
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('redirects a seeded tutor away from admin-web', async ({ page }) => {
    await page.route('http://localhost:3002/**', async (route) => {
      await route.fulfill({ status: 200, body: 'Tutor portal' });
    });

    await signIn(page, 'john.doe@altitutor.test');

    await expect(page).toHaveURL('http://localhost:3002/');
  });
});

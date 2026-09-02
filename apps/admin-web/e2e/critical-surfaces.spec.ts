import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@altitutor.test');
  await page.getByPlaceholder('Enter your password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard\/\d{4}-\d{2}-\d{2}$/, {
    timeout: 30_000,
  });
}

test('an admin can reach Student and Class operations', async ({ page }) => {
  const pageErrors: string[] = [];
  const serverFailures: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  await signIn(page);

  const surfaces = [
    ['/students', 'In-person Students'],
    ['/online-students', 'Online Students'],
    ['/classes', 'Classes'],
  ] as const;
  for (const [path, heading] of surfaces) {
    await test.step(path, async () => {
      const response = await page.goto(path);
      expect(response?.ok(), `${path} must return a successful response`).toBe(
        true,
      );
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible({ timeout: 30_000 });
    });
  }

  await page.getByRole('button', { name: 'Add Class' }).click();
  await expect(
    page.getByText('Step 1 of 3: Class details').last(),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
});

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

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add class', exact: true }).click();
  await expect(
    page.getByText('Step 1 of 3: Offering details').last(),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
});

test('shared date and exact-minute time fields retain keyboard edits across wizard steps', async ({ page }) => {
  await signIn(page);
  await page.goto('/classes');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add class', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Class', exact: true });
  const dates = dialog.getByRole('button', { name: /^\d{1,2} [A-Z][a-z]{2} \d{4}$/ });
  await expect(dates).toHaveCount(2);
  await dates.nth(0).press('Enter');
  const dateInput = page.getByRole('textbox', { name: 'Type a date', exact: true });
  await expect(dateInput).toBeFocused();
  await dateInput.press('Escape');
  await expect(dateInput).toBeHidden();
  await expect(dates.nth(0)).toBeFocused();
  await expect(dialog).toBeVisible();

  for (const [index, query, label] of [
    [0, '17 June 2099', '17 Jun 2099'],
    [1, '17 July 2099', '17 Jul 2099'],
  ] as const) {
    await dates.nth(index).press('Enter');
    await dateInput.fill(query);
    await dateInput.press('Enter');
    await expect(dateInput).toBeHidden();
    await expect(dates.nth(index)).toHaveText(label);
    await expect(dates.nth(index)).toBeFocused();
  }

  await dialog.getByRole('combobox').filter({ hasText: 'Select subject' }).click();
  await page.getByPlaceholder('Search subjects...').fill('Mathematical Methods');
  await page.getByRole('option', { name: /Mathematical Methods/ }).first().click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  const start = dialog.getByRole('button', { name: 'Start time for day 1' });
  const duration = dialog.getByRole('button', { name: 'Duration for day 1' });
  await expect(duration).toHaveText('90 minutes');
  await start.press('Enter');
  const timeInput = page.getByPlaceholder('Type a time, e.g. 4, 415, or 1615');
  await expect(timeInput).toBeFocused();
  await timeInput.press('Escape');
  await expect(timeInput).toBeHidden();
  await expect(start).toBeFocused();
  await expect(dialog).toBeVisible();

  await start.press('Enter');
  await timeInput.fill('16:17');
  await expect(page.getByRole('option', { name: '4:17 pm', exact: true })).toBeVisible();
  await timeInput.press('Enter');
  await expect(start).toContainText('4:17 pm');
  await expect(duration).toHaveText('90 minutes');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dates.nth(0)).toHaveText('17 Jun 2099');
  await expect(dates.nth(1)).toHaveText('17 Jul 2099');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(start).toContainText('4:17 pm');
  await expect(duration).toHaveText('90 minutes');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
});

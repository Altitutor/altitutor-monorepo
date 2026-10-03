import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { expect, test as base } from '@playwright/test';

const test = base.extend<{ subsidyStudentId: string }>({
  subsidyStudentId: async ({ baseURL }, use) => {
    const url = process.env.ADMIN_E2E_SUPABASE_URL;
    const key = process.env.ADMIN_E2E_SERVICE_ROLE_KEY;
    if (!url || !key || !baseURL ||
      !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
      !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
      throw new Error('Subsidy activity fixtures require local Supabase and a local web server');
    }
    const database = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const id = randomUUID();
    const { error } = await database.from('students').insert({
      id, first_name: 'Alice', last_name: 'Williams', status: 'ACTIVE',
    });
    if (error) throw new Error(error.message);
    try {
      await use(id);
    } finally {
      const { error: cleanupError } = await database.from('students').delete().eq('id', id);
      if (cleanupError) throw new Error(cleanupError.message);
    }
  },
});

test('subsidy saves appear in Student activity once, with actor and old/new rates', async ({ page, subsidyStudentId }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@altitutor.test');
  await page.getByPlaceholder('Enter your password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard\/\d{4}-\d{2}-\d{2}$/, { timeout: 30_000 });
  await page.goto(`/students/${subsidyStudentId}`);
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(page.locator('.text-sm.leading-6').filter({ hasText: /added a subsidy for Alice Williams/ })).toHaveCount(0);

  const openSubsidies = async () => {
    await page.getByRole('tab', { name: 'Billing', exact: true }).click();
    await page.getByRole('tab', { name: 'Subsidies', exact: true }).click();
  };
  await openSubsidies();
  await page.getByRole('button', { name: 'Add Subsidy', exact: true }).click();
  const addDialog = page.getByRole('dialog', { name: 'Add Subsidy' });
  await addDialog.getByRole('button', { name: 'Select a subject' }).click();
  await page.getByRole('option').first().click();
  await addDialog.getByLabel('Subsidy price per hour (in dollars)').fill('12.34');
  await addDialog.getByRole('button', { name: 'Add Subsidy', exact: true }).click();
  await expect(addDialog).toBeHidden();

  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  const addition = page.locator('.text-sm.leading-6').filter({ hasText: /added a subsidy for Alice Williams/ });
  await expect(addition).toContainText('Admin User');
  await expect(addition).toContainText('12.34 AUD/hour');
  await expect(addition).toHaveCount(1);
  await expect(addition.getByRole('button', { name: 'Open student Alice Williams' })).toBeVisible();

  await openSubsidies();
  const row = page.getByRole('row').filter({ hasText: '$12.34 AUD' });
  await row.getByRole('button').first().click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Subsidy' });
  await editDialog.getByLabel('Subsidy price per hour (in dollars)').fill('10.50');
  await editDialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(editDialog).toBeHidden();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  const edit = page.locator('.text-sm.leading-6').filter({ hasText: /changed the subsidy for Alice Williams/ });
  await expect(edit).toContainText('hourly rate from 12.34 AUD/hour to 10.50 AUD/hour');
  await expect(edit).toHaveCount(1);
  await expect(edit).toContainText('Admin User');

  await openSubsidies();
  await page.getByRole('row').filter({ hasText: '$10.50 AUD' }).getByRole('button').first().click();
  await editDialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(editDialog).toBeHidden();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(edit).toHaveCount(1);
  await expect(addition).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('subsidy-activity.png'), fullPage: true });

  await openSubsidies();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('row').filter({ hasText: '$10.50 AUD' }).getByRole('button').last().click();
  await expect(page.getByRole('row').filter({ hasText: '$10.50 AUD' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(page.locator('.text-sm.leading-6').filter({ hasText: /removed a subsidy for Alice Williams/ })).toContainText('10.50 AUD/hour');
  expect(failures).toEqual([]);
});

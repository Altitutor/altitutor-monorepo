import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { expect, test as base } from '@playwright/test';
import { ownedPdfDatabase, readExportedPdf } from '../../../scripts/e2e/resource-pdf';

const test = base.extend<{ printableForm: string }>({
  printableForm: async ({ baseURL }, provideForm) => {
    const database = ownedPdfDatabase('ADMIN', baseURL);
    const id = randomUUID();
    const versionId = randomUUID();
    try {
      await database.from('forms').insert({ id, name: 'PDF regression form', purpose: 'e2e_pdf' }).throwOnError();
      await database.from('form_versions').insert({ id: versionId, form_id: id, version_number: 3, blocks: [
        { id: 'instructions', type: 'content', title: 'Instructions', body: { type: 'doc', content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Complete this form clearly.' }] },
        ] } },
        { id: 'choice', type: 'single_choice', title: 'Choose a subject', required: true, options: [
          { id: 'maths', label: 'Mathematics', value: 'maths' }, { id: 'biology', label: 'Biology', value: 'biology' },
        ] },
      ] }).throwOnError();
      await database.from('forms').update({ latest_published_version_id: versionId }).eq('id', id).throwOnError();
      await provideForm(id);
    } finally {
      await database.from('forms').delete().eq('id', id).throwOnError();
    }
  },
});

test('an Admin downloads a readable published form PDF', async ({ page, printableForm }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@altitutor.test');
  await page.getByPlaceholder('Enter your password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard\/\d{4}-\d{2}-\d{2}$/, { timeout: 30_000 });
  const response = await page.request.get(`/api/forms/${printableForm}/pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect(response.headers()['content-disposition']).toContain('.pdf');
  const bytes = await response.body();
  const output = test.info().outputPath('published-form.pdf');
  await writeFile(output, bytes);
  await test.info().attach('Exported PDF', { path: output, contentType: 'application/pdf' });
  const pdf = await readExportedPdf(bytes);
  expect(pdf.pages).toBe(1);
  for (const expected of ['PDF regression form', 'Version 3', 'Student / parent name',
    'Complete this form clearly.', 'Choose a subject', 'Mathematics', 'Biology', 'Page 1 of 1']) {
    expect(pdf.text).toContain(expected);
  }
});

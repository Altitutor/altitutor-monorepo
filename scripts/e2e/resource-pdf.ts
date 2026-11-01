import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { test as base, expect, type Locator, type Page } from '@playwright/test';

export function ownedPdfDatabase(prefix: 'ADMIN' | 'STUDENT' | 'TUTOR', baseURL: string | undefined) {
  const url = process.env[`${prefix}_E2E_SUPABASE_URL`];
  const key = process.env[`${prefix}_E2E_SERVICE_ROLE_KEY`];
  const ownedLocal = Boolean(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST) ||
    (process.env.ALTITUTOR_OWNED_DB_INNER === '1' && Boolean(process.env.ALTITUTOR_TEST_DB_MANIFEST));
  const hostedCI = process.platform === 'linux' && process.env.GITHUB_ACTIONS === 'true' &&
    process.env.RUNNER_ENVIRONMENT === 'github-hosted';
  if ((!ownedLocal && !hostedCI) || !url || !key || !baseURL ||
    !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
    throw new Error('PDF fixtures require owned local Supabase and a local web server');
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function resourcePdfTest(prefix: 'STUDENT' | 'TUTOR') {
  return base.extend<{ resourcePdf: { href: string; filename: string; storagePath: string } }>({
    resourcePdf: async ({ baseURL, page }, provideResource) => {
      const database = ownedPdfDatabase(prefix, baseURL);
      const id = randomUUID();
      const filename = `resource-${id}.pdf`;
      const code = `PDF-${id.slice(0, 8)}`;
      const bytes = readFileSync(path.resolve(__dirname, 'fixtures/two-page-resource.pdf'));
      const topicId = '30000000-0000-0000-0000-000000000001';
      const { data: topic } = await database.from('topics').select('code, subject_id')
        .eq('id', topicId).single().throwOnError();
      if (!topic) throw new Error('Seeded resource topic missing');
      const { data: subject } = await database.from('subjects').select('short_name')
        .eq('id', topic.subject_id).single().throwOnError();
      if (!subject?.short_name) throw new Error('Seeded resource subject missing');
      const storagePath = `${topic.subject_id}/${topicId}/${filename}`;
      try {
        const { error } = await database.storage.from('resources').upload(storagePath, bytes, { contentType: 'application/pdf' });
        if (error) throw error;
        await database.from('files').insert({ id, filename, bucket: 'resources', storage_path: storagePath,
          mimetype: 'application/pdf', size_bytes: bytes.length }).throwOnError();
        await database.from('topics_files').insert({ id, code, topic_id: topicId, file_id: id,
          type: 'NOTES', index: 10_000 + Number.parseInt(id.slice(0, 6), 16) }).throwOnError();
        // Sibling ordering triggers may renumber the public code after INSERT.
        const { data: resource } = await database.from('topics_files').select('code').eq('id', id).single().throwOnError();
        if (!resource) throw new Error('Resource fixture missing');
        const { data: signed, error: signingError } = await database.storage.from('resources').createSignedUrl(storagePath, 900);
        if (signingError || !signed) throw signingError ?? new Error('Could not sign PDF fixture');
        // Storage policies are not installed in disposable stacks. Stub only
        // this external signing response; render the actual stored PDF bytes.
        const signedUrl = new URL(signed.signedUrl);
        await page.route((url) => url.pathname.endsWith(storagePath) &&
          url.pathname.includes('/storage/v1/object/sign/'), async (route) => {
          if (route.request().method() === 'POST') {
            await route.fulfill({ json: { signedURL: signedUrl.pathname.replace('/storage/v1', '') + signedUrl.search } });
          } else {
            await route.fallback();
          }
        });
        await provideResource({ href: `/resources/${encodeURIComponent(subject.short_name.toLowerCase())}/${topic.code}/${resource.code.toLowerCase()}`,
          filename, storagePath });
      } finally {
        await database.from('topics_files').delete().eq('id', id).throwOnError();
        await database.from('files').delete().eq('id', id).throwOnError();
        const { error } = await database.storage.from('resources').remove([storagePath]);
        if (error) throw error;
      }
    },
  });
}

export async function signInForResource(page: Page, href: string, email: string) {
  await page.goto(`/login?next=${encodeURIComponent(href)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByPlaceholder('Enter your password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL((url) => url.pathname === href, { timeout: 30_000 });
  const welcome = page.getByRole('dialog', { name: /Welcome,/u });
  await welcome.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await welcome.isVisible()) {
    await welcome.getByRole('button', { name: 'Continue' }).click();
    await welcome.getByRole('button', { name: 'Finish' }).click();
    await expect(welcome).toBeHidden();
  }
}

export async function expectResourcePages(viewer: Locator) {
  const pages = viewer.locator('canvas');
  await expect(pages).toHaveCount(2, { timeout: 30_000 });
  // The independent fixture has green on page 1 and blue on page 2.
  for (const [index, colour] of [[0, [26, 179, 51]], [1, [51, 77, 230]]] as const) {
    const actual = await pages.nth(index).evaluate((canvas: HTMLCanvasElement) =>
      Array.from(canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data).slice(0, 3));
    // PDF colour conversion differs by one channel value across browsers.
    actual.forEach((channel, channelIndex) => expect(Math.abs(channel - colour[channelIndex])).toBeLessThanOrEqual(1));
  }
  await pages.nth(1).scrollIntoViewIfNeeded();
  await expect(pages.nth(1)).toBeInViewport();
}

export async function readExportedPdf(bytes: Buffer) {
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const document = await task.promise;
    const texts: string[] = [];
    let hasImage = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      texts.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '));
      const operators = await page.getOperatorList();
      hasImage ||= operators.fnArray.includes(OPS.paintImageXObject);
    }
    return { pages: document.numPages, text: texts.join(' ').replace(/\s+/g, ' ').trim(), hasImage };
  } finally {
    await task.destroy();
  }
}

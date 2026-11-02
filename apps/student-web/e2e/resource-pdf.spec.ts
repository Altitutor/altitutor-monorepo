import { expect } from '@playwright/test';
import { resourcePdfTest, signInForResource, expectResourcePages, captureRuntimeErrors, expectResourcePageZoom } from '../../../scripts/e2e/resource-pdf';

const test = resourcePdfTest('STUDENT');

test('a student retries a failed PDF, reads both pages and reopens it @compat', async ({ page, browserName, resourcePdf }) => {
  const errors = captureRuntimeErrors(page);
  let failDownload = true;
  await page.route((url) => url.pathname.endsWith(resourcePdf.storagePath) &&
    url.pathname.includes('/storage/v1/object/'), (route) => failDownload && route.request().method() === 'GET'
      ? route.fulfill({ status: 400, contentType: 'application/json', json: { message: 'InvalidJWT' } })
      : route.fallback());
  await signInForResource(page, resourcePdf.href, 'alice.williams@student.test');
  const viewer = page.getByLabel(resourcePdf.filename, { exact: true });
  await expect(viewer.getByText('Couldn’t load this PDF.')).toBeVisible({ timeout: 30_000 });
  failDownload = false;
  await viewer.getByRole('button', { name: 'Retry PDF', exact: true }).click();
  await expectResourcePages(viewer);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectResourcePages(viewer);
  await expectResourcePageZoom(page, viewer, browserName);
  await page.getByRole('link', { name: 'Resources', exact: true }).last().click();
  await expect(page).toHaveURL((url) => url.pathname === '/resources');
  await expect(page.getByRole('heading', { level: 1, name: 'Resources', exact: true })).toBeVisible();
  await page.goto(resourcePdf.href);
  await expectResourcePages(viewer);
  await page.reload();
  await expectResourcePages(viewer);
  const screenshot = test.info().outputPath('resource-pages.png');
  await viewer.screenshot({ path: screenshot });
  await test.info().attach('Rendered resource pages', { path: screenshot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

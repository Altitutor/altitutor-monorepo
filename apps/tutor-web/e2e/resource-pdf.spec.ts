import { expect } from '@playwright/test';
import { resourcePdfTest, signInForResource, expectResourcePages, captureRuntimeErrors, expectResourcePageZoom } from '../../../scripts/e2e/resource-pdf';

const test = resourcePdfTest('TUTOR');

test('a tutor reads both resource PDF pages and reopens the file @compat', async ({ page, browserName, resourcePdf }) => {
  const errors = captureRuntimeErrors(page);
  await signInForResource(page, resourcePdf.href, 'john.doe@altitutor.test');
  const viewer = page.getByLabel(resourcePdf.filename, { exact: true });
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

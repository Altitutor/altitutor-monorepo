import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 393, height: 852 } });

test("medical interview trial call to action fits a narrow phone @compat", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 852 });
  await page.goto("/classes/medical-interview-preparation/");
  await expect(page.getByRole("link", { name: "Book a free trial" }).last()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("mobile menu covers the viewport and restores page interaction @compat", async ({
  page,
}) => {
  await page.goto("/classes/weekly-classes/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator("main")
      .evaluate((element) => element.hasAttribute("inert")),
  ).toBe(true);
  const bounds = await page.locator("[class*='menuBackdrop']").boundingBox();
  expect(bounds?.y).toBeLessThanOrEqual(0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeGreaterThanOrEqual(852);
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
  ).toBeHidden();
  expect(
    await page
      .locator("main")
      .evaluate((element) => element.hasAttribute("inert")),
  ).toBe(false);
  expect(
    await page.locator("body").evaluate((element) => element.style.overflow),
  ).not.toBe("hidden");
});

for (const course of ["weekly-classes", "examprep"]) {
  test(`${course} keeps course cards readable on phones @compat`, async ({
    page,
  }) => {
    await page.goto(`/classes/${course}/`);
    const cards = page.locator("main [class*='courseCards']").first();
    await expect(cards).toBeAttached();
    expect(
      await cards.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(" "),
      ),
    ).toHaveLength(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(393);
  });
}

test("UCAT feature sheet animates from the bottom and can reopen @compat", async ({
  page,
}) => {
  await page.goto("/ucat/");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Learn more" }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveCSS(
      "animation-name",
      "ui-dialog-bottom-sheet-in",
    );
    await expect
      .poll(() =>
        sheet.evaluate((element) =>
          Math.round(element.getBoundingClientRect().bottom),
        ),
      )
      .toBe(852);
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toBeHidden();
  }
});

test("UCAT gallery stops rotating while offscreen @compat", async ({
  page,
}) => {
  await page.goto("/ucat/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  const gallery = page.getByRole("tabpanel");
  const label = await gallery.getAttribute("aria-label");
  await page.waitForTimeout(7500);
  await expect(gallery).toHaveAttribute("aria-label", label!);
});

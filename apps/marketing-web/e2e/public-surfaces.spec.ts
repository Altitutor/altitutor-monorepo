import { expect, test } from "@playwright/test";

test("header course menus work after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about/");
  await page.mouse.wheel(0, 1000);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(72);

  const inPerson = page.getByRole("button", {
    name: "In person courses",
    exact: true,
  });
  await inPerson.hover();
  await expect(inPerson).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("navigation", { name: "In person courses", exact: true }),
  ).toBeVisible();

  const online = page.getByRole("button", {
    name: "Online courses",
    exact: true,
  });
  await online.hover();
  await expect(online).toHaveAttribute("aria-expanded", "true");
  const onlineMenu = page.getByRole("navigation", {
    name: "Online courses",
    exact: true,
  });
  await expect(onlineMenu).toBeVisible();
  await online.press("Escape");
  await expect(onlineMenu).toBeHidden();

  await inPerson.focus();
  await inPerson.press("ArrowDown");
  await expect(
    page
      .getByRole("navigation", { name: "In person courses", exact: true })
      .getByRole("link")
      .first(),
  ).toBeFocused();
});

test("page section chips navigate after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about/");
  const sections = page.getByRole("navigation", {
    name: "Page sections",
    exact: true,
  });
  await expect(sections).toBeVisible();
  const last = sections.getByRole("link").last();
  const target = await last.getAttribute("href");
  await last.click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(target);
  await expect(last).toHaveAttribute("aria-current", "location");
});

test("course sidebar clears the header with the announcement visible and dismissed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/classes/weekly-classes/");
  const sidebar = page.getByRole("navigation", { name: "Course sections" });
  await sidebar.getByRole("link").last().click();
  const header = page.getByRole("banner");
  const expectSidebarClear = async () => {
    await expect
      .poll(async () => {
        return sidebar.evaluate(
          (element) =>
            element.getBoundingClientRect().top -
            parseFloat(getComputedStyle(element).top),
        );
      })
      .toBeLessThanOrEqual(1);
    await expect
      .poll(async () => {
        const sidebarBounds = await sidebar.boundingBox();
        const headerBounds = await header.boundingBox();
        if (!sidebarBounds || !headerBounds) return -1;
        return sidebarBounds.y - (headerBounds.y + headerBounds.height);
      })
      .toBeGreaterThanOrEqual(16);
  };
  await expectSidebarClear();
  await page
    .getByRole("button", { name: "Dismiss medicine interview announcement" })
    .click();
  await expectSidebarClear();
});

const publicSurfaces = [
  {
    path: "/ucat/",
    heading: /UCAT Prep\?.*Planned for you\./i,
  },
  {
    path: "/",
    heading: /Want better results\?.*Altitutor can help\./i,
  },
] as const;

for (const surface of publicSurfaces) {
  test(`${surface.path} presents its primary customer promise @compat`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const serverFailures: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto(surface.path);

    expect(
      response?.ok(),
      `${surface.path} must return a successful response`,
    ).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: surface.heading }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(serverFailures).toEqual([]);
  });
}

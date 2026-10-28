import { expect, test } from "@playwright/test";

test("blog discovery, canonical and draft exclusion", async ({
  page,
  request,
}) => {
  await page.goto("/blog/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Our blog.");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://altitutor.com/blog/",
  );
  await expect(
    page.locator("main").getByRole("link", { name: "Authoring example" }),
  ).toHaveCount(0);
  expect((await request.get("/blog/authoring-example/")).status()).toBe(404);
  expect((await request.get("/blog/unknown/")).status()).toBe(404);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("https://altitutor.com/blog/");
  expect(sitemap).not.toContain("/blog/authoring-example/");
  const image = await request.get("/blog/opengraph-image/");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
});

test("blog is discoverable on mobile without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/blog/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page
      .locator("#mobile-navigation")
      .getByRole("link", { name: "Blog", exact: true }),
  ).toBeVisible();
});

test("blog attribution survives navigation to UCAT", async ({ page }) => {
  await page.goto("/blog/?utm_source=newsletter&utm_campaign=blog-review");
  const firstTouch = async () => {
    const cookies = await page.context().cookies();
    const cookie = cookies.find(
      (item) => item.name === "ucat_acquisition_first_touch",
    );
    return cookie ? JSON.parse(decodeURIComponent(cookie.value)) : null;
  };
  await expect.poll(firstTouch).toMatchObject({
    landingPath: "/blog/",
    utmSource: "newsletter",
    utmCampaign: "blog-review",
  });
  const original = await firstTouch();
  await page.goto("/ucat/?utm_source=later");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await firstTouch()).toEqual(original);
});

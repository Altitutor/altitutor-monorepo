import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 393, height: 852 } });

test("mobile navigation retains the glass and background blur @compat", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("header")).toHaveCSS(
    "backdrop-filter",
    "blur(16px)",
  );
  await expect(page.locator("[class*='menuBackdrop']")).toHaveCSS(
    "backdrop-filter",
    "blur(3px)",
  );
});

test("footer paints the bottom inset instead of leaving a separate strip", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CDP supplies nonzero safe-area insets; WebKit headless does not.",
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 47, bottom: 34, left: 0, right: 0 },
  });
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveCSS("padding-bottom", "60px");
  const geometry = await footer.evaluate((element) => ({
    bottom: Math.round(element.getBoundingClientRect().bottom + window.scrollY),
    pageBottom: document.documentElement.scrollHeight,
    background: getComputedStyle(element).backgroundColor,
    canvas: getComputedStyle(document.body).backgroundColor,
  }));
  expect(geometry.bottom).toBe(geometry.pageBottom);
  expect(geometry.canvas).toBe(geometry.background);
});

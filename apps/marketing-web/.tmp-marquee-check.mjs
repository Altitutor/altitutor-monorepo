import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3003/", { waitUntil: "networkidle" });
const section = page
  .locator("section")
  .filter({ has: page.getByRole("heading", { name: /have to say/i }) });
await section.scrollIntoViewIfNeeded();
const heading = await section
  .getByRole("heading", { name: /have to say/i })
  .innerText();
const statsGone = await section.locator("[class*='statValue']").count();
const rows = section.locator("[class*='marqueeRow']");
const rowCount = await rows.count();
const stars = await section.locator("[aria-label='5 star review']").count();
const cards = await section.locator("figure").count();
const link = await section.getByRole("link", { name: /All reviews/i }).count();

async function trackX(row) {
  return row
    .locator("[class*='marqueeTrack']")
    .evaluate((el) => getComputedStyle(el).transform);
}

const before = await trackX(rows.nth(0));
await page.waitForTimeout(700);
const after = await trackX(rows.nth(0));
const beforeReverse = await trackX(rows.nth(1));
await rows.nth(0).hover({ position: { x: 200, y: 40 } });
const pausedA = await trackX(rows.nth(0));
await page.waitForTimeout(600);
const pausedB = await trackX(rows.nth(0));
const reverseDuringHover = await trackX(rows.nth(1));

await section.screenshot({ path: "/tmp/student-stories-desktop.png" });
await page.setViewportSize({ width: 390, height: 844 });
await section.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await section.screenshot({ path: "/tmp/student-stories-mobile.png" });

console.log(
  JSON.stringify(
    {
      heading,
      statsGone,
      rowCount,
      stars,
      cards,
      link,
      before,
      after,
      moved: before !== after,
      pausedA,
      pausedB,
      paused: pausedA === pausedB,
      beforeReverse,
      reverseDuringHover,
      reverseKeptMoving: beforeReverse !== reverseDuringHover,
    },
    null,
    2,
  ),
);
await browser.close();

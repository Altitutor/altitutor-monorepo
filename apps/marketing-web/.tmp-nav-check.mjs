import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto("http://127.0.0.1:3003/", { waitUntil: "networkidle" });

const inPerson = page.getByRole("button", { name: "In person courses" });
const online = page.getByRole("button", { name: "Online courses" });
await inPerson.click();
const expanded = await inPerson.getAttribute("aria-expanded");
const panel = page.locator("#desktop-course-navigation");
await page.waitForTimeout(500);
const panelText = await panel.innerText();
const panelOpen = await page
  .locator("[data-desktop-panel]")
  .getAttribute("data-open");
const urlAfterClick = page.url();
await page.waitForTimeout(200);
const stillOpen = await inPerson.getAttribute("aria-expanded");
await online.click();
const switched = await online.getAttribute("aria-expanded");
const inPersonAfter = await inPerson.getAttribute("aria-expanded");
const urlAfterSwitch = page.url();

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:3003/about/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  window.__pointerTypes = [];
  document
    .querySelector("[data-course-trigger]")
    ?.addEventListener("pointerenter", (event) => {
      window.__pointerTypes.push(event.pointerType);
    });
});
await page.getByRole("button", { name: "In person courses" }).hover();
await page.waitForTimeout(200);
const pointerTypes = await page.evaluate(() => window.__pointerTypes);
const hoverButton = page.getByRole("button", { name: "In person courses" });
const hoverExpanded = await hoverButton.getAttribute("aria-expanded");
const hoverOpen = await page
  .locator("[data-desktop-panel]")
  .getAttribute("data-open");

console.log(
  JSON.stringify(
    {
      expanded,
      stillOpen,
      switched,
      inPersonAfter,
      urlAfterClick,
      urlAfterSwitch,
      hoverExpanded,
      hoverOpen,
      panelOpen,
      panelText: panelText.slice(0, 180),
      pointerTypes,
    },
    null,
    2,
  ),
);
await browser.close();

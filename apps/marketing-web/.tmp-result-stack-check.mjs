import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const outDir = new URL("./.tmp-find-course/", import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function measure(page, title) {
  await page.evaluate((year) => {
    const nav = document.querySelector("[data-marketing-nav]");
    const card = [...document.querySelectorAll("article")].find(
      (el) => el.querySelector("h3")?.textContent === year,
    );
    if (!nav || !card) throw new Error(`missing ${year}`);
    const navBottom = nav.getBoundingClientRect().bottom;
    const expectedTop =
      navBottom + (window.innerHeight - navBottom - card.offsetHeight) / 2;
    const docTop = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, docTop - expectedTop + 40);
  }, title);
  await page.waitForTimeout(250);
  return page.evaluate((year) => {
    const nav = document.querySelector("[data-marketing-nav]");
    const card = [...document.querySelectorAll("article")].find(
      (el) => el.querySelector("h3")?.textContent === year,
    );
    const navBottom = nav.getBoundingClientRect().bottom;
    const rect = card.getBoundingClientRect();
    const availableMid = navBottom + (window.innerHeight - navBottom) / 2;
    const cardMid = rect.top + rect.height / 2;
    return {
      year,
      navBottom: Math.round(navBottom),
      viewport: window.innerHeight,
      cardTop: Math.round(rect.top),
      cardMid: Math.round(cardMid),
      availableMid: Math.round(availableMid),
      midDelta: Math.round(cardMid - availableMid),
      styleTop: card.style.top,
    };
  }, title);
}

async function run(viewport, name) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://127.0.0.1:3003/about/testimonials/", {
    waitUntil: "networkidle",
  });
  const years = await page.locator("#results h3").allTextContents();
  const first = await measure(page, "2025 results");
  await page.screenshot({
    path: new URL(`result-stack-${name}-2025.png`, outDir).pathname,
    fullPage: false,
  });
  const third = await measure(page, "2023 results");
  await page.screenshot({
    path: new URL(`result-stack-${name}-2023.png`, outDir).pathname,
    fullPage: false,
  });
  await page.close();
  return { name, years, first, third };
}

const desktop = await run({ width: 1440, height: 900 }, "desktop");
const mobile = await run({ width: 390, height: 844 }, "mobile");
console.log(JSON.stringify({ desktop, mobile }, null, 2));
await browser.close();

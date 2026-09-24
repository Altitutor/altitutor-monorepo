import {
  getAllMarketingPages,
  getMarketingPage,
  getRenderableHtml,
} from "../wordpress";
import legacyRedirects from "../legacy-redirects.json";

const EXTRA_APP_PATHS = new Set([
  "/ucat/",
  "/online-learning/",
  "/sentry-example-page/",
  "/sitemap.xml",
  "/robots.txt",
]);

const LIVE_MARKETING_PATHS = new Set([
  ...getAllMarketingPages().map((page) => page.path),
  ...EXTRA_APP_PATHS,
]);

function extractHrefs(html: string): string[] {
  return [...html.matchAll(/\bhref=(["'])(.*?)\1/gi)].map((match) => match[2]);
}

function normalizeMarketingPath(pathname: string): string {
  if (pathname.startsWith("/wp-content/") || pathname.startsWith("/wp-includes/")) {
    return pathname;
  }
  if (pathname.includes(".")) {
    return pathname;
  }
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function brokenMarketingHrefs(html: string): string[] {
  const broken = new Set<string>();

  for (const href of extractHrefs(html)) {
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(href, "https://altitutor.com");
    } catch {
      broken.add(href);
      continue;
    }

    const host = url.hostname.replace(/^www\./, "");
    if (host !== "altitutor.com") {
      continue;
    }

    const pathname = normalizeMarketingPath(url.pathname);
    if (
      pathname.startsWith("/wp-content/") ||
      pathname.startsWith("/wp-includes/") ||
      LIVE_MARKETING_PATHS.has(pathname)
    ) {
      continue;
    }

    broken.add(href);
  }

  return [...broken].sort();
}

describe("getRenderableHtml", () => {
  it("keeps the classes page medical interview button on a live path", () => {
    const page = getMarketingPage("/classes/");
    expect(page).toBeDefined();
    const html = getRenderableHtml(page!);
    expect(html).toContain('href="/classes/medical-interview-preparation/"');
    expect(html).not.toContain('href="/medical-interview-preparation/"');
    expect(html).not.toContain('href="https://altitutor.com/medical-interview-preparation/"');
  });

  it("does not emit internal hrefs that 404 on the marketing site", () => {
    const brokenByPage = getAllMarketingPages()
      .map((page) => ({
        path: page.path,
        hrefs: brokenMarketingHrefs(getRenderableHtml(page)),
      }))
      .filter((entry) => entry.hrefs.length > 0);

    expect(brokenByPage).toEqual([]);
  });

  it("points each legacy page redirect at a live marketing path", () => {
    const invalidDestinations = Object.entries(legacyRedirects.pageRedirects)
      .filter(([, destination]) => !LIVE_MARKETING_PATHS.has(destination))
      .map(([source, destination]) => ({ source, destination }));

    expect(invalidDestinations).toEqual([]);
  });

  it("removes the medical interview trial-booking CTA from the WordPress export", () => {
    const page = getMarketingPage("/classes/medical-interview-preparation/");
    expect(page).toBeDefined();
    const html = getRenderableHtml(page!);
    expect(html).not.toContain("Interested? Book a free trial session now.");
    expect(html).not.toContain("How to get started");
    expect(html).not.toContain("Book a trial session");
    expect(html).not.toContain("/booking/trial-session");
  });
});

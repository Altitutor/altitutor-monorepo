import {
  createMetadata,
  getAllMarketingPages,
  getMarketingPage,
  getSitemapPages,
} from "../pages";
import legacyRedirects from "../legacy-redirects.json";
import content from "@/features/marketing/content/production.json";

const livePaths = new Set([
  ...getAllMarketingPages().map((page) => page.path),
  "/ucat/",
  "/online-courses/",
  "/online-courses/sace-ib-resources/",
  "/classes/assignment-drafting/",
]);

describe("native marketing content", () => {
  it("preserves canonical metadata and social previews", () => {
    const metadata = createMetadata(getMarketingPage("/"));
    expect(metadata.alternates?.canonical).toBe("https://altitutor.com/");
    expect(metadata.description).toBeTruthy();
    expect(metadata.openGraph).toBeDefined();
  });
  it("keeps legacy page redirects pointing at live routes", () => {
    expect(
      Object.values(legacyRedirects.pageRedirects).filter(
        (path) => !livePaths.has(path),
      ),
    ).toEqual([]);
  });
  it("excludes account and checkout pages from the sitemap", () => {
    expect(getSitemapPages().map((page) => page.path)).not.toEqual(
      expect.arrayContaining(["/checkout/", "/my-account/"]),
    );
  });
  it("keeps production copy free of executable legacy markup", () => {
    expect(JSON.stringify(content)).not.toMatch(
      /<script|<iframe|elementor-widget|jquery/i,
    );
  });
});

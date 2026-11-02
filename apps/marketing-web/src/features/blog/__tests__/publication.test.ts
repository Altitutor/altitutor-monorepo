jest.mock("@/content/blog/authoring-example.mdx", () => ({
  __esModule: true,
  default: () => null,
}));
import { getArticle, getArticles } from "../articles";
import sitemap from "@/app/sitemap";

describe("committed blog content", () => {
  it("does not expose the authoring draft through public lookups", () => {
    expect(getArticles().map((article) => article.slug)).not.toContain(
      "authoring-example",
    );
    expect(getArticle("authoring-example")).toBeUndefined();
    expect(getArticle("unknown")).toBeUndefined();
  });
  it("includes the hub but never a draft in the actual sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://altitutor.com/blog/");
    expect(urls).not.toContain("https://altitutor.com/blog/authoring-example/");
  });
});

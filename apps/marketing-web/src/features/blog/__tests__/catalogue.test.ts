import { defineArticles, publishedArticles, type Article } from "../catalogue";
import { articleSchema, blogMetadata } from "../metadata";
const content = () => null;
const fixture: Article = {
  slug: "example",
  title: "Example",
  description: "Description",
  author: "A tutor",
  category: "guide",
  conversionTarget: "trial-session",
  status: "published",
  publishedAt: "2026-09-20",
  content,
};

describe("blog publishing boundary", () => {
  it("keeps drafts out and lists published content newest first", () => {
    const entries = defineArticles([
      fixture,
      { ...fixture, slug: "draft", status: "draft" },
      { ...fixture, slug: "newer", publishedAt: "2026-09-25" },
    ]);
    expect(publishedArticles(entries).map((entry) => entry.slug)).toEqual([
      "newer",
      "example",
    ]);
  });
  it.each([
    { slug: "../escape" },
    { slug: "opengraph-image" },
    { category: "toString" },
    { title: " " },
    { publishedAt: undefined },
    { publishedAt: "2026-02-30" },
    { updatedAt: "2026-09-01" },
    { category: "unknown" },
    { authorType: "unknown" },
    { status: "unknown" },
    { conversionTarget: undefined },
    { conversionTarget: "unknown" },
    { conversionTarget: "toString" },
  ])("rejects invalid metadata %p", (invalid) => {
    expect(() =>
      defineArticles([{ ...fixture, ...invalid } as Article]),
    ).toThrow();
  });
  it("rejects duplicate slugs even when one is a draft", () => {
    expect(() =>
      defineArticles([fixture, { ...fixture, status: "draft" }]),
    ).toThrow();
  });
  it("represents organizational bylines accurately", () => {
    expect(
      articleSchema({
        ...fixture,
        author: "Altitutor",
        authorType: "Organization",
      }).author,
    ).toEqual({ "@type": "Organization", name: "Altitutor" });
  });
  it("gives an article one canonical URL and truthful dates", () => {
    expect(blogMetadata(fixture).alternates?.canonical).toBe(
      "https://altitutor.com/blog/example/",
    );
    expect(articleSchema(fixture)).toMatchObject({
      mainEntityOfPage: "https://altitutor.com/blog/example/",
      datePublished: "2026-09-20",
      dateModified: "2026-09-20",
    });
  });
});

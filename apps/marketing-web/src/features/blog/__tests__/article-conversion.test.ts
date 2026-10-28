import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ArticleRoute from "@/app/blog/[slug]/page";
import { PRODUCT_LINKS } from "@/lib/site";
import type { Article } from "../catalogue";
import type { ReactNode } from "react";

jest.mock("@/features/blog/articles", () => ({
  getArticle: () => mockArticle,
}));
jest.mock("@/features/blog/blog.module.css", () => ({}));
jest.mock("@/features/marketing/components/site-frame", () => ({
  SiteFrame: ({
    primaryAction,
    children,
  }: {
    primaryAction: { href: string; label: string };
    children: ReactNode;
  }) =>
    createElement(
      "main",
      null,
      createElement("a", { href: primaryAction.href }, primaryAction.label),
      children,
    ),
}));
jest.mock("@/features/marketing/components/primitives", () => ({
  Button: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));
const mockArticle: Article = {
  slug: "example",
  title: "Example",
  description: "A useful guide",
  category: "guide",
  author: "A tutor",
  status: "published",
  publishedAt: "2026-09-30",
  conversionTarget: "trial-session",
  content: () => createElement("p", null, "The article answer"),
};

it.each([
  [
    "trial-session",
    PRODUCT_LINKS.trialBooking,
    "Book a free trial session",
    "Free trial",
  ],
  [
    "ucat-signup",
    PRODUCT_LINKS.ucatSignup,
    "Start UCAT practice for free",
    "Start free",
  ],
] as const)(
  "wires %s to both navigation and the article's next step",
  (target, href, label, navLabel) => {
    mockArticle.conversionTarget = target;
    const html = renderToStaticMarkup(
      createElement(ArticleRoute, { params: { slug: "example" } }),
    );
    expect(html).toContain(`href="${href}">${navLabel}</a>`);
    expect(html).toContain(`href="${href}">${label}</a>`);
    expect(html.indexOf('id="article-next-step"')).toBeGreaterThan(
      html.indexOf("The article answer"),
    );
    const other =
      target === "ucat-signup"
        ? PRODUCT_LINKS.trialBooking
        : PRODUCT_LINKS.ucatSignup;
    expect(html).not.toContain(`href="${other}"`);
  },
);

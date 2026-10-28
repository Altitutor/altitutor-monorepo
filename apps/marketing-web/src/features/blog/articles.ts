import Example from "@/content/blog/authoring-example.mdx";
import { defineArticles, publishedArticles, type Article } from "./catalogue";

// Explicit trusted imports keep authoring reviewable. Drafts never have public routes.
const catalogue = defineArticles([
  {
    slug: "authoring-example",
    title: "Authoring example",
    description:
      "A private example of the shared article layout and resource component.",
    category: "guide",
    conversionTarget: "trial-session",
    author: "Altitutor",
    authorType: "Organization",
    status: "draft",
    content: Example,
  },
] satisfies Article[]);

export function getArticles() {
  return publishedArticles(catalogue);
}
export function getArticle(slug: string) {
  return getArticles().find((article) => article.slug === slug);
}

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { articlePath, type Article } from "./catalogue";

export const BLOG_DESCRIPTION =
  "Study guides, useful resources and the latest from Altitutor.";
export function blogMetadata(article?: Article): Metadata {
  const title = article ? `${article.title} | Altitutor` : "Blog | Altitutor";
  const description = article?.description ?? BLOG_DESCRIPTION;
  const url = `${SITE_URL}${article ? articlePath(article.slug) : "/blog/"}`;
  const images = [
    {
      url: `${SITE_URL}/blog/opengraph-image/`,
      width: 1200,
      height: 630,
      alt: "Altitutor Blog",
    },
  ];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    ...(article ? { authors: [{ name: article.author }] } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: "Altitutor",
      locale: "en_AU",
      images,
      ...(article
        ? {
            type: "article",
            publishedTime: article.publishedAt,
            modifiedTime: article.updatedAt ?? article.publishedAt,
            authors: [article.author],
          }
        : { type: "website" }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}
export function articleSchema(article: Article) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    mainEntityOfPage: `${SITE_URL}${articlePath(article.slug)}`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: { "@type": article.authorType ?? "Person", name: article.author },
    publisher: { "@type": "Organization", name: "Altitutor", url: SITE_URL },
  };
}

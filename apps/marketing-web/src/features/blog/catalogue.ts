import type { ComponentType } from "react";
import {
  isConversionTarget,
  type ConversionTarget,
} from "@/features/marketing/conversion-actions";

export const categories = {
  guide: "Guides",
  "product-update": "Product updates",
} as const;
export type Category = keyof typeof categories;
export interface Article {
  slug: string;
  title: string;
  description: string;
  category: Category;
  conversionTarget: ConversionTarget;
  author: string;
  authorType?: "Person" | "Organization";
  status: "draft" | "published";
  publishedAt?: string;
  updatedAt?: string;
  content: ComponentType;
}

function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

/** Fail the build on invalid editorial metadata, before any routes are exposed. */
export function defineArticles(
  entries: readonly Article[],
): readonly Article[] {
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
      slugs.has(entry.slug) ||
      entry.slug === "opengraph-image"
    )
      throw new Error(`Invalid or duplicate blog slug: ${entry.slug}`);
    slugs.add(entry.slug);
    if (!isConversionTarget(entry.conversionTarget))
      throw new Error(
        `Missing or invalid blog conversion target: ${entry.slug}`,
      );
    if (
      ![entry.title, entry.description, entry.author].every((value) =>
        value.trim(),
      )
    )
      throw new Error(`Missing blog metadata: ${entry.slug}`);
    if (
      !Object.prototype.hasOwnProperty.call(categories, entry.category) ||
      !["draft", "published"].includes(entry.status)
    )
      throw new Error(`Invalid blog category or status: ${entry.slug}`);
    if (
      entry.authorType &&
      !["Person", "Organization"].includes(entry.authorType)
    )
      throw new Error(`Invalid blog author type: ${entry.slug}`);
    if (entry.status === "published" && !entry.publishedAt)
      throw new Error(
        `Published article needs a publication date: ${entry.slug}`,
      );
    for (const date of [entry.publishedAt, entry.updatedAt])
      if (date && !validDate(date))
        throw new Error(`Invalid blog date: ${entry.slug}`);
    if (
      entry.updatedAt &&
      (!entry.publishedAt || entry.updatedAt < entry.publishedAt)
    )
      throw new Error(`Updated date precedes publication: ${entry.slug}`);
  }
  return entries;
}

/** Public routes, listings and sitemap all use this same publication boundary. */
export function publishedArticles(entries: readonly Article[]): Article[] {
  return entries
    .filter((entry) => entry.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}
export const articlePath = (slug: string) => `/blog/${slug}/`;
export function articleDate(date: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

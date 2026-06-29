import type { MetadataRoute } from "next";
import { sitemapPages } from "@/content/marketing-pages";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: page.modified,
    changeFrequency: page.path === "/" ? "weekly" : "monthly",
    priority: page.path === "/" ? 1 : 0.7,
  }));
}

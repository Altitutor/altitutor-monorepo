import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getSitemapPages } from "@/lib/wordpress";

export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapPages().map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: page.modified,
    changeFrequency: page.path === "/" ? "weekly" : "monthly",
    priority: page.path === "/" ? 1 : 0.7,
  }));
}

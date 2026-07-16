import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getSitemapPages } from "@/lib/wordpress";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const legacyPages: MetadataRoute.Sitemap = getSitemapPages().map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: page.modified,
    changeFrequency: page.path === "/" ? "weekly" : "monthly",
    priority: page.path === "/" ? 1 : 0.7,
  }));

  return [
    ...legacyPages,
    {
      url: `${SITE_URL}/ucat/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/online-learning/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}

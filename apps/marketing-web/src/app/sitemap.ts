import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getSitemapPages } from "@/lib/pages";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const legacyPages: MetadataRoute.Sitemap = getSitemapPages()
    .filter(
      (page) =>
        !["/resources/", "/classes/english-assignment-drafting/"].includes(
          page.path,
        ),
    )
    .map((page) => ({
      url: `${SITE_URL}${page.path}`,
      // Imported WordPress timestamps do not include a timezone. A date-only
      // value is unambiguous and valid under the sitemap protocol.
      lastModified: page.modified.slice(0, 10),
      changeFrequency: page.path === "/" ? "weekly" : "monthly",
      priority: page.path === "/" ? 1 : 0.7,
    }));

  return [
    ...legacyPages,
    ...[
      "/online-courses/",
      "/online-courses/sace-ib-resources/",
      "/classes/assignment-drafting/",
    ].map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/ucat/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}

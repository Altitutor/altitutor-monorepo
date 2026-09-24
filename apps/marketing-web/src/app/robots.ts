import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/cart/",
        "/checkout/",
        "/my-account/",
        "/activate/",
        "/new-admin-registration/",
        "/new-student-registration/",
        "/new-tutor-registration/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

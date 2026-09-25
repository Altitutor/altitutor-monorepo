import type { Metadata } from "next";
import pages from "@/content/pages.json";
import { SITE_NAME, SITE_URL } from "./site";

type PageImage = {
  url?: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
};

type PageRobots = {
  index?: string;
  follow?: string;
  "max-snippet"?: string;
  "max-image-preview"?: string;
  "max-video-preview"?: string;
};

type PageSchema = {
  "@context"?: string;
  "@graph"?: unknown[];
};

type PageSeo = {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: PageRobots;
  og_locale?: string;
  og_type?: string;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_site_name?: string;
  og_image?: PageImage[];
  twitter_card?: string;
  twitter_site?: string;
  schema?: PageSchema;
};

export type MarketingPage = {
  path: string;
  title: string;
  excerpt: string;
  modified: string;
  seo: PageSeo;
};

const marketingPages = pages as MarketingPage[];

const REDIRECTED_PATHS = new Set([
  "/new-student-registration/",
  "/new-tutor-registration/",
  "/new-admin-registration/",
]);

const NOINDEX_PATHS = new Set([
  "/activate/",
  "/cart/",
  "/checkout/",
  "/my-account/",
  "/privacy-policy/",
]);

const SITEMAP_EXCLUDED_PATHS = new Set([...REDIRECTED_PATHS, ...NOINDEX_PATHS]);

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

export function pathFromSlug(slug?: string[]) {
  if (!slug || slug.length === 0) return "/";
  return normalizePath(slug.join("/"));
}

export function getMarketingPage(path: string) {
  const normalizedPath = normalizePath(path);
  return marketingPages.find((page) => page.path === normalizedPath);
}

export function getAllMarketingPages() {
  return marketingPages;
}

export function getSitemapPages() {
  return marketingPages.filter((page) => {
    const robotsIndex = page.seo?.robots?.index;
    return robotsIndex !== "noindex" && !SITEMAP_EXCLUDED_PATHS.has(page.path);
  });
}

export function getPageSchema(page: MarketingPage) {
  return page.seo?.schema && Object.keys(page.seo.schema).length > 0
    ? page.seo.schema
    : undefined;
}

export function createMetadata(page?: MarketingPage): Metadata {
  if (!page) {
    return {
      title: `Page not found | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const seo = page.seo ?? {};
  const robotsIndex = NOINDEX_PATHS.has(page.path)
    ? "noindex"
    : seo.robots?.index;
  const shouldIndex = robotsIndex !== "noindex";
  const shouldFollow = seo.robots?.follow !== "nofollow";
  const canonical = seo.canonical || `${SITE_URL}${page.path}`;
  const description = seo.description;
  const socialDescription =
    seo.og_description || description || stripHtml(page.excerpt);
  const ogImage = seo.og_image?.[0];

  return {
    title: seo.title || `${page.title} | ${SITE_NAME}`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: seo.og_title || seo.title || page.title,
      description: socialDescription,
      url: seo.og_url || canonical,
      siteName: seo.og_site_name || SITE_NAME,
      locale: seo.og_locale === "en_US" ? "en_AU" : seo.og_locale || "en_AU",
      type: "website",
      images: ogImage?.url
        ? [
            {
              url: ogImage.url,
              width: ogImage.width,
              height: ogImage.height,
              alt: ogImage.alt || page.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      site: seo.twitter_site || "@Altitutor",
      title: seo.og_title || seo.title || page.title,
      description: socialDescription,
      images: ogImage?.url ? [ogImage.url] : undefined,
    },
    robots: {
      index: shouldIndex,
      follow: shouldFollow,
      googleBot: {
        index: shouldIndex,
        follow: shouldFollow,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

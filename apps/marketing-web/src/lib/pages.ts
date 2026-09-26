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

/** WooCommerce shells that still 200'd after the migration. */
const RETIRED_COMMERCE_PATHS = new Set([
  "/activate/",
  "/cart/",
  "/checkout/",
  "/my-account/",
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
  return marketingPages.filter((page) => !RETIRED_COMMERCE_PATHS.has(page.path));
}

export function getSitemapPages() {
  return marketingPages.filter((page) => {
    const robotsIndex = page.seo?.robots?.index;
    return robotsIndex !== "noindex" && !SITEMAP_EXCLUDED_PATHS.has(page.path);
  });
}

const ORGANIZATION_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "31 Craighill Rd",
  addressRegion: "SA",
  postalCode: "5064",
  addressCountry: "AU",
};

export function getPageSchema(page: MarketingPage) {
  const schema = page.seo?.schema;
  if (!schema || Object.keys(schema).length === 0) return undefined;
  return sanitizeSchema(structuredClone(schema));
}

/** Yoast copied a WordPress search action and a duplicated Home crumb onto every page. */
function sanitizeSchema(schema: PageSchema): PageSchema {
  const graph = schema["@graph"];
  if (!Array.isArray(graph)) return schema;
  for (const node of graph) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if (record["@type"] === "WebSite") delete record.potentialAction;
    if (record["@type"] === "Organization") {
      record.address = ORGANIZATION_ADDRESS;
    }
    if (
      record["@type"] === "BreadcrumbList" &&
      Array.isArray(record.itemListElement)
    ) {
      const items = record.itemListElement as Array<{ name?: string }>;
      let seenHome = false;
      record.itemListElement = items.filter((item) => {
        if (item.name !== "Home") return true;
        if (seenHome) return false;
        seenHome = true;
        return true;
      });
    }
  }
  return schema;
}

export function buildRouteSchema(
  path: string,
  name: string,
  description: string,
) {
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name,
        description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: "en-AU",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name,
            item: url,
          },
        ],
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        address: ORGANIZATION_ADDRESS,
      },
    ],
  };
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

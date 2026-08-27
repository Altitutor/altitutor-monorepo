import type { Metadata } from "next";
import pages from "@/content/wordpress-pages.json";
import legacyRedirects from "./legacy-redirects.json";
import { SITE_NAME, SITE_URL } from "./site";

type YoastImage = {
  url?: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
};

type YoastRobots = {
  index?: string;
  follow?: string;
  "max-snippet"?: string;
  "max-image-preview"?: string;
  "max-video-preview"?: string;
};

type YoastSchema = {
  "@context"?: string;
  "@graph"?: unknown[];
};

type YoastSeo = {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: YoastRobots;
  og_locale?: string;
  og_type?: string;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_site_name?: string;
  og_image?: YoastImage[];
  twitter_card?: string;
  twitter_site?: string;
  schema?: YoastSchema;
};

export type MarketingPage = {
  id: number;
  path: string;
  title: string;
  html: string;
  excerpt: string;
  date: string;
  modified: string;
  seo: YoastSeo;
};

const marketingPages = pages as MarketingPage[];

export const MEDICAL_INTERVIEW_PREPARATION_PATH =
  "/classes/medical-interview-preparation/";

const MEDICAL_INTERVIEW_REMOVED_SECTION_IDS = [
  "e1266e4", // How to get started
  "8d9ab25", // Interested? Book a free trial
] as const;

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

const SITEMAP_EXCLUDED_PATHS = new Set([
  ...REDIRECTED_PATHS,
  ...NOINDEX_PATHS,
]);

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
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

export function getPageStylePath(page: MarketingPage) {
  return `/wp-content/uploads/elementor/css/post-${page.id}.css`;
}

export function getRenderableHtml(page: MarketingPage) {
  let html = removeElementorWidget(
    page.html || `<p>${page.title}</p>`,
    "elementor-widget-table-of-contents",
  );

  if (page.path === MEDICAL_INTERVIEW_PREPARATION_PATH) {
    for (const sectionId of MEDICAL_INTERVIEW_REMOVED_SECTION_IDS) {
      html = removeElementorElement(html, "section", `data-id="${sectionId}"`);
    }
  }

  return rewriteLegacyHrefs(html)
    .replace(
      /<div class="elementor-toc__spinner-container">[\s\S]*?<\/div>/g,
      "",
    )
    .replace(
      /(<span class="elementor-counter-number"[^>]*data-to-value="([^"]+)"[^>]*>)[^<]*(<\/span>)/g,
      "$1$2$3",
    );
}

function replaceHref(html: string, from: string, to: string) {
  return html
    .replaceAll(`href="${from}"`, `href="${to}"`)
    .replaceAll(`href='${from}'`, `href='${to}'`);
}

function rewriteLegacyHrefs(html: string) {
  let result = html
    .replaceAll("https://www.altitutor.com/wp-content/", "/wp-content/")
    .replaceAll("https://altitutor.com/wp-content/", "/wp-content/")
    .replaceAll("http://www.altitutor.com/wp-content/", "/wp-content/")
    .replaceAll("http://altitutor.com/wp-content/", "/wp-content/")
    .replaceAll("https://www.altitutor.com/", "/")
    .replaceAll("https://altitutor.com/", "/")
    .replaceAll("http://www.altitutor.com/", "/")
    .replaceAll("http://altitutor.com/", "/");

  const replacements: Array<[string, string]> = [
    ...Object.entries(legacyRedirects.pageRedirects),
    ...legacyRedirects.trialBookingPaths.map(
      (from) => [from, legacyRedirects.trialBookingUrl] as [string, string],
    ),
  ];

  for (const [from, to] of replacements) {
    result = replaceHref(result, from, to);
    if (from.endsWith("/") && from !== "/") {
      result = replaceHref(result, from.slice(0, -1), to);
    }
  }

  return result;
}

function removeElementorElement(
  html: string,
  tag: "div" | "section",
  marker: string,
) {
  let result = html;
  let markerIndex = result.indexOf(marker);

  while (markerIndex !== -1) {
    const start = result.lastIndexOf(`<${tag}`, markerIndex);
    if (start === -1) break;

    let depth = 0;
    const tagPattern = new RegExp(`</?${tag}\\b[^>]*>`, "g");
    tagPattern.lastIndex = start;

    let end = -1;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(result)) !== null) {
      if (match[0].startsWith("</")) {
        depth -= 1;
        if (depth === 0) {
          end = tagPattern.lastIndex;
          break;
        }
      } else {
        depth += 1;
      }
    }

    if (end === -1) break;
    result = `${result.slice(0, start)}${result.slice(end)}`;
    markerIndex = result.indexOf(marker);
  }

  return result;
}

function removeElementorWidget(html: string, widgetClass: string) {
  return removeElementorElement(html, "div", widgetClass);
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
  const robotsIndex = NOINDEX_PATHS.has(page.path) ? "noindex" : seo.robots?.index;
  const shouldIndex = robotsIndex !== "noindex";
  const shouldFollow = seo.robots?.follow !== "nofollow";
  const canonical = seo.canonical || `${SITE_URL}${page.path}`;
  const description = seo.description;
  const socialDescription = seo.og_description || description || stripHtml(page.excerpt);
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

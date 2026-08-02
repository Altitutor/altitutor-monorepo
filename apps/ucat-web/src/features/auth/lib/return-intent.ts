const INTERNAL_ORIGIN = "https://ucat.altitutor.com";
const MAX_RETURN_INTENT_LENGTH = 4_096;

export const CAMPAIGN_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const POST_AUTH_BLOCKED_PATHS = [
  "/api",
  "/auth",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/marketing-preview",
  "/_next",
] as const;

function isBlockedPostAuthPath(pathname: string): boolean {
  return POST_AUTH_BLOCKED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Accepts only a same-origin path. This is the base security boundary for any
 * client or server navigation fed by a query parameter.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (
    !value ||
    value.length > MAX_RETURN_INTENT_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * A destination that may be resumed after authentication and onboarding.
 * Authentication, API, preview and framework routes are deliberately excluded
 * to prevent loops and accidental redirects into non-page endpoints.
 */
export function safePostAuthReturnPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  const path = safeInternalPath(value, fallback);
  const pathname = new URL(path, INTERNAL_ORIGIN).pathname;
  return isBlockedPostAuthPath(pathname) ? fallback : path;
}

export function pathWithReturnIntent(
  pathname: string,
  returnTo: string | null | undefined,
  extraParams: Record<string, string> = {},
): string {
  const url = new URL(pathname, INTERNAL_ORIGIN);
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }

  const safeReturnTo = safePostAuthReturnPath(returnTo);
  if (safeReturnTo !== "/dashboard") {
    url.searchParams.set("redirect", safeReturnTo);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function copyCampaignQueryParams(
  source: URLSearchParams,
  destination: URLSearchParams,
): void {
  for (const key of CAMPAIGN_QUERY_KEYS) {
    const value = source.get(key);
    if (value) destination.set(key, value.slice(0, 200));
  }
}

export function authEntryPath(
  pathname: "/login" | "/signup",
  returnTo: string | null | undefined,
  campaignSource: URLSearchParams,
): string {
  const url = new URL(pathname, INTERNAL_ORIGIN);
  url.searchParams.set("redirect", safePostAuthReturnPath(returnTo));
  copyCampaignQueryParams(campaignSource, url.searchParams);
  return `${url.pathname}${url.search}`;
}

export function campaignProperties(
  searchParams: URLSearchParams,
): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const key of CAMPAIGN_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) properties[key] = value.slice(0, 200);
  }
  return properties;
}

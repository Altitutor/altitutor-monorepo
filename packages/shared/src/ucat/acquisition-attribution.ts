export const UCAT_ACQUISITION_SOURCES = [
  "reddit",
  "tiktok",
  "instagram",
  "facebook",
  "search",
  "friend_or_classmate",
  "altitutor_tutor",
  "school_or_teacher",
  "business_card_or_flyer",
  "other",
  "not_sure",
] as const;

export type UcatAcquisitionSource =
  (typeof UCAT_ACQUISITION_SOURCES)[number];

export type UcatObservedFirstTouch = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrerDomain: string | null;
  landingPath: string;
  capturedAt: string;
};

export const UCAT_ACQUISITION_COOKIE_NAME = "ucat_acquisition_first_touch";

const MAX_CAMPAIGN_VALUE_LENGTH = 256;
const MAX_LANDING_PATH_LENGTH = 1_024;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function isUcatAcquisitionSource(
  value: unknown,
): value is UcatAcquisitionSource {
  return (
    typeof value === "string" &&
    (UCAT_ACQUISITION_SOURCES as readonly string[]).includes(value)
  );
}

export function normalizeUcatAcquisitionSources(
  value: unknown,
): UcatAcquisitionSource[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(isUcatAcquisitionSource)) return null;

  const sources = [...new Set(value)];
  if (sources.includes("not_sure") && sources.length > 1) return null;
  return sources;
}

function boundedQueryValue(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, MAX_CAMPAIGN_VALUE_LENGTH) : null;
}

function safeReferrerDomain(referrer: string): string | null {
  if (!referrer.trim()) return null;
  try {
    return new URL(referrer).hostname.slice(0, 253) || null;
  } catch {
    return null;
  }
}

export function buildUcatObservedFirstTouch(input: {
  searchParams: URLSearchParams;
  pathname: string;
  referrer: string;
  capturedAt?: string;
}): UcatObservedFirstTouch {
  return {
    utmSource: boundedQueryValue(input.searchParams.get("utm_source")),
    utmMedium: boundedQueryValue(input.searchParams.get("utm_medium")),
    utmCampaign: boundedQueryValue(input.searchParams.get("utm_campaign")),
    utmContent: boundedQueryValue(input.searchParams.get("utm_content")),
    utmTerm: boundedQueryValue(input.searchParams.get("utm_term")),
    referrerDomain: safeReferrerDomain(input.referrer),
    landingPath: input.pathname.slice(0, MAX_LANDING_PATH_LENGTH) || "/",
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  };
}

export function parseUcatObservedFirstTouch(
  value: unknown,
): UcatObservedFirstTouch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const capturedAt =
    typeof record.capturedAt === "string" ? record.capturedAt : "";
  const landingPath =
    typeof record.landingPath === "string" ? record.landingPath : "";
  if (
    !landingPath.startsWith("/") ||
    landingPath.length > MAX_LANDING_PATH_LENGTH ||
    !capturedAt ||
    Number.isNaN(Date.parse(capturedAt))
  ) {
    return null;
  }

  const optionalValue = (key: string, maxLength: number): string | null => {
    const candidate = record[key];
    if (candidate === null || candidate === undefined || candidate === "") {
      return null;
    }
    return typeof candidate === "string" && candidate.length <= maxLength
      ? candidate
      : null;
  };

  return {
    utmSource: optionalValue("utmSource", MAX_CAMPAIGN_VALUE_LENGTH),
    utmMedium: optionalValue("utmMedium", MAX_CAMPAIGN_VALUE_LENGTH),
    utmCampaign: optionalValue("utmCampaign", MAX_CAMPAIGN_VALUE_LENGTH),
    utmContent: optionalValue("utmContent", MAX_CAMPAIGN_VALUE_LENGTH),
    utmTerm: optionalValue("utmTerm", MAX_CAMPAIGN_VALUE_LENGTH),
    referrerDomain: optionalValue("referrerDomain", 253),
    landingPath,
    capturedAt: new Date(capturedAt).toISOString(),
  };
}

function cookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return valueParts.join("=");
  }
  return null;
}

export function readUcatObservedFirstTouchCookie(
  cookieHeader: string,
): UcatObservedFirstTouch | null {
  const encoded = cookieValue(cookieHeader, UCAT_ACQUISITION_COOKIE_NAME);
  if (!encoded) return null;
  try {
    return parseUcatObservedFirstTouch(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    return null;
  }
}

export function writeUcatObservedFirstTouchCookie(
  attribution: UcatObservedFirstTouch,
  hostname: string,
): string {
  const encoded = encodeURIComponent(JSON.stringify(attribution));
  const isAltitutorDomain =
    hostname === "altitutor.com" || hostname.endsWith(".altitutor.com");
  return [
    `${UCAT_ACQUISITION_COOKIE_NAME}=${encoded}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(isAltitutorDomain ? ["Domain=.altitutor.com", "Secure"] : []),
  ].join("; ");
}

export function captureUcatObservedFirstTouchInBrowser(input: {
  searchParams: URLSearchParams;
  pathname: string;
}): UcatObservedFirstTouch | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const existing = readUcatObservedFirstTouchCookie(document.cookie);
  if (existing) return existing;

  const attribution = buildUcatObservedFirstTouch({
    searchParams: input.searchParams,
    pathname: input.pathname,
    referrer: document.referrer,
  });
  document.cookie = writeUcatObservedFirstTouchCookie(
    attribution,
    window.location.hostname,
  );
  return attribution;
}

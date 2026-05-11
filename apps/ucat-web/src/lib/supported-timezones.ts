const COMMON_TIMEZONES_FALLBACK = [
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

/**
 * All IANA time zones supported by the runtime (Node / modern browsers), sorted.
 * Falls back to a short list if `Intl.supportedValuesOf` is unavailable.
 */
export function getSupportedIanaTimeZones(): string[] {
  try {
    const intl = Intl as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") {
      return intl.supportedValuesOf("timeZone").slice().sort((a, b) => a.localeCompare(b));
    }
  } catch {
    // ignore — use fallback
  }
  return [...COMMON_TIMEZONES_FALLBACK].sort((a, b) => a.localeCompare(b));
}

/** Ensures `timeZone` appears in the options list (e.g. legacy DB value). */
export function mergeTimeZoneIntoOptions(timeZone: string, options: string[]): string[] {
  if (options.includes(timeZone)) return options;
  return [...options, timeZone].sort((a, b) => a.localeCompare(b));
}

const supportedIanaTimeZoneSet = new Set(getSupportedIanaTimeZones());

export function isSupportedIanaTimeZone(timeZone: string): boolean {
  return supportedIanaTimeZoneSet.has(timeZone);
}

const OFFSET_NAME_STYLES = ["longOffset", "shortOffset"] as const;

/**
 * Current UTC offset label for an IANA zone (e.g. `GMT+10:30` or `GMT+10`),
 * using the runtime's `Intl` data. Empty string if it cannot be resolved.
 */
export function getTimeZoneGmtOffsetLabel(
  ianaTimeZone: string,
  at: Date = new Date(),
): string {
  for (const timeZoneName of OFFSET_NAME_STYLES) {
    try {
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: ianaTimeZone,
        timeZoneName,
      });
      const part = formatter.formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
      if (part) {
        return part.replace(/^UTC/i, "GMT");
      }
    } catch {
      // try next style or give up
    }
  }
  return "";
}

/** Display line for dropdowns: `Australia/Sydney (GMT+11:00)`. */
export function formatTimeZoneWithGmtOffset(
  ianaTimeZone: string,
  at: Date = new Date(),
): string {
  const offset = getTimeZoneGmtOffsetLabel(ianaTimeZone, at);
  return offset ? `${ianaTimeZone} (${offset})` : ianaTimeZone;
}

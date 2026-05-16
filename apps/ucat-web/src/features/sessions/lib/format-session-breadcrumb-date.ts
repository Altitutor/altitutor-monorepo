const ADELAIDE_TZ = "Australia/Adelaide";

/** Short date for breadcrumbs (matches session list card wording). */
export function formatSessionBreadcrumbDate(
  startAtIso: string | null | undefined,
): string {
  if (!startAtIso) return "Session";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: ADELAIDE_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(startAtIso));
}

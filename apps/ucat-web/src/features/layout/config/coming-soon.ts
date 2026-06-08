/**
 * Path prefixes for features that are still in development.
 * Students cannot access these routes; they see a "coming soon" modal instead.
 * Add or remove paths here to control which features are gated.
 */
export const COMING_SOON_PATHS: string[] = ["/learn"];

/**
 * Returns true if the given pathname is a coming-soon route (exact or subpath).
 */
export function isComingSoon(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return COMING_SOON_PATHS.some(
    (path) => normalized === path || normalized.startsWith(`${path}/`),
  );
}

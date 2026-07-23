/**
 * Paths reachable before `ucat_signup_completed_at` is set.
 * Keep middleware and OnboardingGateRedirect in sync.
 */
const ALLOWED_BEFORE_SIGNUP_COMPLETE = [
  "/signup/complete",
  "/checkout",
] as const;

export function isAllowedBeforeSignupComplete(pathname: string): boolean {
  return ALLOWED_BEFORE_SIGNUP_COMPLETE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

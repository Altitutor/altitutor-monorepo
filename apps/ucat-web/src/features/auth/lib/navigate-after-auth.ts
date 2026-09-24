/**
 * Full document navigation after an auth state change.
 *
 * Soft navigations (`router.push`/`replace`/`refresh`) race middleware
 * `getUser()` cookie refresh against the App Router cache. That bounce
 * (`/signup` ↔ `/signup/complete`) can call `history.replaceState` until
 * Safari throws SecurityError (100 calls / 10s).
 */
export function navigateAfterAuth(path: string): void {
  window.location.assign(safeInternalPath(path, "/signup/complete"));
}
import { safeInternalPath } from "@/features/auth/lib/return-intent";

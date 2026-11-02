import type { NextRequest, NextResponse } from "next/server";
import { isAuthCookie } from "@/lib/supabase/auth-cookie";
import type { UcatPortalAccess } from "./portal-access";

/** Temporary DEV-261 probe. Remove after a real failing/successful boundary pair
 * supports an incident-shaped regression. Never pass URLs or auth data to logs.
 */
export function reportNativeContinuation(
  request: NextRequest,
  next: string,
  outcome: UcatPortalAccess["status"],
  response: NextResponse,
  startedAt: number,
): void {
  try {
    const route = new URL(request.url);
    if (new URL(next, route).pathname !== "/mobile-auth") return;
    const location = response.headers.get("location");
    const path = location ? new URL(location, route).pathname : null;
    const destination =
      path === "/mobile-auth" ? "native-return" :
      path === "/login" ? "login" :
      path === "/signup/complete" ? "signup-complete" :
      path === "/auth/staff-account" ? "staff-account" :
      response.status === 503 ? "unavailable" : "other";
    const host = request.headers.get("host");
    // eslint-disable-next-line no-console -- Temporary bounded server probe (DEV-261).
    console.info("[DEBUG-ucat-native-continue-v1]", {
      outcome,
      destination,
      auth_cookie_chunks: Math.min(8, request.cookies.getAll().filter(({ name }) => isAuthCookie(name)).length),
      request_host_matches_route: host === null ? null : host === route.host,
      elapsed_ms: Math.min(60_000, Math.max(0, Date.now() - startedAt)),
    });
  } catch {
    // Diagnostics must never interrupt sign-in, including when a log sink fails.
  }
}

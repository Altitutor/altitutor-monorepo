import { normalizeUcatInvitationCode } from "@altitutor/shared";
const KEY = "ucat:pending-invitation";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Browser convenience only; availability and eligibility are always checked by the API. */
export function pendingInvitation(): string | null {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const value: unknown = JSON.parse(stored);
      if (
        value &&
        typeof value === "object" &&
        "code" in value &&
        "expiresAt" in value &&
        typeof value.expiresAt === "number" &&
        value.expiresAt > Date.now()
      ) {
        return normalizeUcatInvitationCode(value.code);
      }
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      return null;
    }
    const legacy = normalizeUcatInvitationCode(sessionStorage.getItem(KEY));
    if (legacy) rememberInvitation(legacy);
    return legacy;
  } catch {
    return null;
  }
}
export function rememberInvitation(code: string | null) {
  try {
    const normalized = normalizeUcatInvitationCode(code);
    if (normalized)
      localStorage.setItem(
        KEY,
        JSON.stringify({
          code: normalized,
          expiresAt: Date.now() + MAX_AGE_MS,
        }),
      );
    else localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage can be disabled; the URL and visible form remain usable. */
  }
}

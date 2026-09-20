import { normalizeUcatInvitationCode } from "@altitutor/shared";
const KEY = "ucat:pending-invitation";
export function pendingInvitation(): string | null {
  try {
    return normalizeUcatInvitationCode(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
export function rememberInvitation(code: string | null) {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* Storage can be disabled; the visible form remains usable. */
  }
}

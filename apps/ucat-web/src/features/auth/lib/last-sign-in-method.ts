import type { SocialAuthProvider } from "@/features/auth/lib/social-auth";

const LAST_SIGN_IN_METHOD_KEY = "ucat-last-sign-in-method";

export type LastSignInMethod = SocialAuthProvider | "password";

function isLastSignInMethod(value: unknown): value is LastSignInMethod {
  return value === "apple" || value === "google" || value === "password";
}

export function getLastSignInMethod(): LastSignInMethod | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LAST_SIGN_IN_METHOD_KEY);
    return isLastSignInMethod(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberLastSignInMethod(method: LastSignInMethod): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SIGN_IN_METHOD_KEY, method);
  } catch {
    // This hint is optional when storage is unavailable.
  }
}

const STORAGE_KEY = "altitutor:ucat:password-authenticated";
const MAX_AGE_MS = 10 * 60 * 1000;

export function savePasswordAuthHandoff(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ createdAt: Date.now() }),
  );
}

export function hasPasswordAuthHandoff(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const value = JSON.parse(raw) as { createdAt?: unknown };
    if (
      typeof value.createdAt === "number" &&
      Date.now() - value.createdAt <= MAX_AGE_MS
    ) {
      return true;
    }
  } catch {
    // Invalid or stale handoffs are discarded below.
  }

  clearPasswordAuthHandoff();
  return false;
}

export function clearPasswordAuthHandoff(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

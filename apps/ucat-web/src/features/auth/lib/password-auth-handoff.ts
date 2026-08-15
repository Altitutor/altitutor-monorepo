const STORAGE_KEY = "altitutor:ucat:password-authenticated";
const MAX_AGE_MS = 10 * 60 * 1000;

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePasswordAuthHandoff(userId: string): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ createdAt: Date.now(), userId }),
    );
  } catch {
    // Password setup remains available when browser storage is unavailable.
  }
}

export function hasPasswordAuthHandoff(userId: string): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as {
      createdAt?: unknown;
      userId?: unknown;
    };
    if (
      typeof value.createdAt === "number" &&
      value.userId === userId &&
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
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // This hint is optional; storage failures must never block authentication.
  }
}

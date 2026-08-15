const PENDING_LOGIN_EMAIL_KEY = "ucat-pending-login-email";
const PENDING_LOGIN_MAX_AGE_MS = 10 * 60 * 1000;

type PendingLoginEmail = {
  createdAt: number;
  email: string;
};

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePendingLoginEmail(email: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    const pending: PendingLoginEmail = {
      createdAt: Date.now(),
      email,
    };
    storage.setItem(PENDING_LOGIN_EMAIL_KEY, JSON.stringify(pending));
  } catch {
    // The login page remains usable when browser storage is unavailable.
  }
}

export function takePendingLoginEmail(): string | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PENDING_LOGIN_EMAIL_KEY);
    storage.removeItem(PENDING_LOGIN_EMAIL_KEY);
    if (!raw) return null;

    const pending = JSON.parse(raw) as Partial<PendingLoginEmail>;
    const age = Date.now() - (pending.createdAt ?? 0);
    return typeof pending.email === "string" &&
      pending.email.includes("@") &&
      age >= 0 &&
      age <= PENDING_LOGIN_MAX_AGE_MS
      ? pending.email
      : null;
  } catch {
    try {
      storage.removeItem(PENDING_LOGIN_EMAIL_KEY);
    } catch {
      // Storage is unavailable; there is nothing else to recover.
    }
    return null;
  }
}

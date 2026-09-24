const PENDING_SIGNUP_EMAIL_KEY = "ucat-pending-signup-email";
const PENDING_SIGNUP_MAX_AGE_MS = 60 * 60 * 1000;

type PendingSignupEmail = {
  context: string;
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

function removePendingSignupEmail(storage: Storage): void {
  try {
    storage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function savePendingSignupEmail(email: string, context: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    const pending: PendingSignupEmail = {
      context,
      createdAt: Date.now(),
      email,
    };
    storage.setItem(PENDING_SIGNUP_EMAIL_KEY, JSON.stringify(pending));
  } catch {
    // Signup remains recoverable by submitting the email again.
  }
}

export function getPendingSignupEmail(context: string): string | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PENDING_SIGNUP_EMAIL_KEY);
    if (!raw) return null;

    const pending = JSON.parse(raw) as Partial<PendingSignupEmail>;
    const isValid =
      pending.context === context &&
      typeof pending.createdAt === "number" &&
      Date.now() - pending.createdAt >= 0 &&
      Date.now() - pending.createdAt <= PENDING_SIGNUP_MAX_AGE_MS &&
      typeof pending.email === "string" &&
      pending.email.includes("@");

    if (isValid) return pending.email!;

    removePendingSignupEmail(storage);
    return null;
  } catch {
    removePendingSignupEmail(storage);
    return null;
  }
}

export function clearPendingSignupEmail(context: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    const raw = storage.getItem(PENDING_SIGNUP_EMAIL_KEY);
    if (!raw) return;

    const pending = JSON.parse(raw) as Partial<PendingSignupEmail>;
    if (pending.context === context) {
      removePendingSignupEmail(storage);
    }
  } catch {
    removePendingSignupEmail(storage);
  }
}

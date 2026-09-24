export type PendingAuth = {
  verifier: string;
  state: string;
  callback: string;
  createdAt: number;
};
export type AuthTokens = { access_token: string; refresh_token: string };
const MAX_AUTH_AGE_MS = 30 * 60 * 1000;

export function readPendingAuth(raw: string | null): PendingAuth | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    if (
      !("verifier" in value) ||
      typeof value.verifier !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(value.verifier)
    )
      return null;
    if (
      !("state" in value) ||
      typeof value.state !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(value.state)
    )
      return null;
    if (!("callback" in value) || typeof value.callback !== "string")
      return null;
    if (
      !("createdAt" in value) ||
      typeof value.createdAt !== "number" ||
      !Number.isFinite(value.createdAt)
    )
      return null;
    return {
      verifier: value.verifier,
      state: value.state,
      callback: value.callback,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

export function parseAuthReturn(url: string) {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const ticket = fragment.get("ticket");
  const state = fragment.get("state");
  if (
    !ticket ||
    !state ||
    fragment.getAll("ticket").length !== 1 ||
    fragment.getAll("state").length !== 1
  )
    throw new Error("The sign-in link is incomplete. Please sign in again.");
  parsed.hash = "";
  return { callback: parsed.toString(), ticket, state };
}

type Dependencies = {
  read: () => Promise<PendingAuth | null>;
  clear: () => Promise<void>;
  exchange: (ticket: string, verifier: string) => Promise<AuthTokens>;
  setSession: (tokens: AuthTokens) => Promise<void>;
  now?: () => number;
};

/** Both the browser result and a deep link can arrive for one return. Exchange once. */
export function createAuthReturnHandler(dependencies: Dependencies) {
  let active: { url: string; promise: Promise<void> } | null = null;
  let completedUrl: string | null = null;
  return function complete(url: string): Promise<void> {
    if (completedUrl === url) return Promise.resolve();
    if (active)
      return active.url === url
        ? active.promise
        : Promise.reject(
            new Error("Another sign-in is finishing. Please wait."),
          );
    const promise = (async () => {
      const result = parseAuthReturn(url);
      const pending = await dependencies.read();
      if (!pending)
        throw new Error("This sign-in has expired. Please sign in again.");
      if (
        result.state !== pending.state ||
        result.callback !== new URL(pending.callback).toString()
      )
        throw new Error(
          "This sign-in link does not match your request. Please sign in again.",
        );
      const age = (dependencies.now?.() ?? Date.now()) - pending.createdAt;
      if (age < 0 || age > MAX_AUTH_AGE_MS) {
        await dependencies.clear();
        throw new Error("This sign-in has expired. Please sign in again.");
      }
      try {
        const tokens = await dependencies.exchange(
          result.ticket,
          pending.verifier,
        );
        await dependencies.setSession(tokens);
        completedUrl = url;
      } finally {
        await dependencies.clear();
      }
    })();
    active = { url, promise };
    void promise
      .finally(() => {
        active = null;
      })
      .catch(() => undefined);
    return promise;
  };
}

type BrowserResult =
  | { type: "success"; url: string }
  | { type: "cancel" | "dismiss" | "locked" };

/** Coordinates the browser result and the independently delivered native link. */
export function createBrowserAuthFlow(dependencies: {
  complete: (url: string) => Promise<void>;
}) {
  let launching = false;
  let returning: Promise<void> | undefined;
  function complete(url: string) {
    const promise = dependencies.complete(url);
    returning = promise;
    void promise
      .finally(() => {
        if (returning === promise) returning = undefined;
      })
      .catch(() => undefined);
    return promise;
  }
  async function launch(open: () => Promise<BrowserResult>) {
    if (launching) return;
    launching = true;
    try {
      await returning?.catch(() => undefined);
      const result = await open();
      if (result.type === "success") await complete(result.url);
    } finally {
      // Dismiss/cancel can precede the independently delivered deep link.
      // Only the return handler consumes its verifier; another launch replaces it
      // and the existing age check expires abandoned requests.
      await returning?.catch(() => undefined);
      launching = false;
    }
  }
  return { complete, launch };
}

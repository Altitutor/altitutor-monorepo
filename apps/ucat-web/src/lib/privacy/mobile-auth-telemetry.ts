// Auth bridge URLs can also appear inside encoded login/onboarding return URLs.
// Never send these URLs, tickets, or related request bodies to telemetry.
const MOBILE_AUTH_PATH =
  /\/(?:mobile-auth|mobile-browser)(?=[/?#\s"'&]|$)|\/api\/auth\/(?:native|browser)\/(?:ticket|exchange)(?=[/?#\s"'&]|$)/;

export function containsMobileAuthData(value: unknown): boolean {
  const visited = new WeakSet<object>();
  function inspect(item: unknown): boolean {
    if (typeof item === "string") {
      let decoded = item;
      for (let depth = 0; depth < 5; depth++) {
        if (MOBILE_AUTH_PATH.test(decoded)) return true;
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
        } catch {
          // An unrelated malformed escape must not hide an encoded return URL.
          const next = decoded.replace(/%[0-9a-f]{2}/gi, (escape) =>
            String.fromCharCode(Number.parseInt(escape.slice(1), 16)),
          );
          if (next === decoded) break;
          decoded = next;
        }
      }
      return false;
    }
    if (!item || typeof item !== "object" || visited.has(item)) return false;
    visited.add(item);
    return Object.values(item).some(inspect);
  }
  return inspect(value);
}

export function isMobileAuthBrowserContext(): boolean {
  return (
    typeof window !== "undefined" &&
    containsMobileAuthData(window.location.href)
  );
}

export function filterMobileAuthTelemetry<T>(event: T): T | null {
  return isMobileAuthBrowserContext() || containsMobileAuthData(event)
    ? null
    : event;
}

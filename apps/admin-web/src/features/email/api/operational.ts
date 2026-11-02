/** Retain one delivery intent across uncertain HTTP responses and page reloads. */
export async function requestOperationalEmail(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const body = init.body;
  let fingerprint: string;
  if (body instanceof FormData) {
    const entries = await Promise.all(
      Array.from(body.entries()).map(async ([name, value]) => {
        if (typeof value === "string") return [name, value];
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await value.arrayBuffer(),
        );
        return [name, value.name, value.type, hex(digest)];
      }),
    );
    fingerprint = JSON.stringify(entries);
  } else fingerprint = typeof body === "string" ? body : "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${url}\n${fingerprint}`),
  );
  const storageKey = `email-delivery-intent:${hex(digest)}`;
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(storageKey);
  } catch {
    /* Memory still protects retries in this page. */
  }
  token ??= intents.get(storageKey) ?? crypto.randomUUID();
  intents.set(storageKey, token);
  try {
    sessionStorage.setItem(storageKey, token);
  } catch {
    /* Storage may be disabled. */
  }
  const headers = new Headers(init.headers);
  headers.set("Idempotency-Key", token);
  const response = await fetch(url, { ...init, headers });
  if (response.ok) {
    const value: unknown = await response.clone().json();
    const partial =
      value &&
      typeof value === "object" &&
      "failed" in value &&
      Array.isArray(value.failed) &&
      value.failed.length > 0;
    if (!partial) {
      intents.delete(storageKey);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Optional durable intent store. */
      }
    }
  }
  return response;
}
const intents = new Map<string, string>();
function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

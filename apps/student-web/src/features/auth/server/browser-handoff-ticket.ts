import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const CONTEXT = "altitutor/student/browser-handoff/v1";
export const BROWSER_HANDOFF_TTL_MS = 60_000;
const destinations = ["/settings/profile", "/settings/flashcards"] as const;

export type BrowserDestination = (typeof destinations)[number];

export type BrowserHandoffPayload = {
  purpose: "browser";
  userId: string;
  tokenHash: string;
  path: BrowserDestination;
};

export function isBrowserDestination(path: unknown): path is BrowserDestination {
  return typeof path === "string" && destinations.some((value) => value === path);
}

function key(secret: string) {
  if (secret.length < 32) throw new Error("Handoff unavailable");
  return createHmac("sha256", secret).update(CONTEXT).digest();
}

export function sealBrowserHandoff(
  payload: BrowserHandoffPayload,
  secret: string,
  now = Date.now(),
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(CONTEXT));
  const encrypted = Buffer.concat([
    cipher.update(
      JSON.stringify({
        ...payload,
        issuedAt: now,
        expiresAt: now + BROWSER_HANDOFF_TTL_MS,
      }),
      "utf8",
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openBrowserHandoff(
  ticket: unknown,
  secret: string,
  now = Date.now(),
): BrowserHandoffPayload {
  if (typeof ticket !== "string" || ticket.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(ticket))
    throw new Error("Invalid handoff");
  const bytes = Buffer.from(ticket, "base64url");
  if (bytes.length < 29) throw new Error("Invalid handoff");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(CONTEXT));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const value: unknown = JSON.parse(
    Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"),
  );
  if (
    !value ||
    typeof value !== "object" ||
    !("purpose" in value) ||
    value.purpose !== "browser" ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !value.userId ||
    !("tokenHash" in value) ||
    typeof value.tokenHash !== "string" ||
    !value.tokenHash ||
    !("path" in value) ||
    !isBrowserDestination(value.path) ||
    !("issuedAt" in value) ||
    typeof value.issuedAt !== "number" ||
    !("expiresAt" in value) ||
    typeof value.expiresAt !== "number" ||
    value.issuedAt > now ||
    value.expiresAt <= now ||
    value.expiresAt - value.issuedAt !== BROWSER_HANDOFF_TTL_MS
  )
    throw new Error("Invalid handoff");
  return {
    purpose: "browser",
    userId: value.userId,
    tokenHash: value.tokenHash,
    path: value.path,
  };
}

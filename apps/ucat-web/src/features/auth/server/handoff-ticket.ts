import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const CONTEXT = "altitutor/ucat/auth-handoff/v1";
export const HANDOFF_TTL_MS = 60_000;
const destinations = [
  "/exam",
  "/settings/profile",
  "/settings/plan",
  "/settings/plan/subscription",
  "/settings/plan/referrals",
  "/settings/study-plan",
] as const;
export type BrowserDestination = (typeof destinations)[number];
export type HandoffPayload = { userId: string; tokenHash: string } & (
  | { purpose: "native"; challenge: string }
  | { purpose: "browser"; path: BrowserDestination }
);
export function isBrowserDestination(
  path: unknown,
): path is BrowserDestination {
  return (
    typeof path === "string" && destinations.some((value) => value === path)
  );
}
export function isChallenge(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
export function matchesVerifier(challenge: string, verifier: unknown) {
  if (
    typeof verifier !== "string" ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
  )
    return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  return (
    isChallenge(challenge) &&
    timingSafeEqual(Buffer.from(challenge), Buffer.from(actual))
  );
}
function key(secret: string) {
  if (secret.length < 32) throw new Error("Handoff unavailable");
  return createHmac("sha256", secret).update(CONTEXT).digest();
}
export function sealHandoff(
  payload: HandoffPayload,
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
        expiresAt: now + HANDOFF_TTL_MS,
      }),
      "utf8",
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function openHandoff(
  ticket: unknown,
  secret: string,
  purpose: HandoffPayload["purpose"],
  now = Date.now(),
): HandoffPayload {
  if (
    typeof ticket !== "string" ||
    ticket.length > 4096 ||
    !/^[A-Za-z0-9_-]+$/.test(ticket)
  )
    throw new Error("Invalid handoff");
  const bytes = Buffer.from(ticket, "base64url");
  if (bytes.length < 29) throw new Error("Invalid handoff");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(CONTEXT));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const value: unknown = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
  if (
    !value ||
    typeof value !== "object" ||
    !("purpose" in value) ||
    value.purpose !== purpose ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !value.userId ||
    !("tokenHash" in value) ||
    typeof value.tokenHash !== "string" ||
    !value.tokenHash ||
    !("issuedAt" in value) ||
    typeof value.issuedAt !== "number" ||
    !("expiresAt" in value) ||
    typeof value.expiresAt !== "number" ||
    value.issuedAt > now ||
    value.expiresAt <= now ||
    value.expiresAt - value.issuedAt !== HANDOFF_TTL_MS
  )
    throw new Error("Invalid handoff");
  if (
    value.purpose === "native" &&
    "challenge" in value &&
    isChallenge(value.challenge)
  )
    return {
      purpose: "native",
      userId: value.userId,
      tokenHash: value.tokenHash,
      challenge: value.challenge,
    };
  if (
    value.purpose === "browser" &&
    "path" in value &&
    isBrowserDestination(value.path)
  )
    return {
      purpose: "browser",
      userId: value.userId,
      tokenHash: value.tokenHash,
      path: value.path,
    };
  throw new Error("Invalid handoff");
}

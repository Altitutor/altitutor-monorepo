/** @jest-environment node */
import { createHash } from "node:crypto";
import { HANDOFF_TTL_MS, matchesVerifier, openHandoff, sealHandoff } from "../handoff-ticket";

const secret = "a-secret-longer-than-thirty-two-characters";
const verifier = "x".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const payload = {
  purpose: "native" as const,
  userId: "student",
  tokenHash: "one-time-supabase-hash",
  challenge,
};

describe("encrypted handoff tickets", () => {
  it("encrypts identity and OTP, with randomized ciphertext", () => {
    const first = sealHandoff(payload, secret, 100);
    expect(first).not.toEqual(sealHandoff(payload, secret, 100));
    expect(Buffer.from(first, "base64url").toString()).not.toContain(payload.tokenHash);
    expect(openHandoff(first, secret, 101)).toEqual(payload);
  });

  it("rejects tampering and wrong keys", () => {
    const ticket = sealHandoff(payload, secret, 100);
    const bytes = Buffer.from(ticket, "base64url");
    bytes[30] ^= 1;
    expect(() => openHandoff(bytes.toString("base64url"), secret, 101)).toThrow();
    expect(() => openHandoff(ticket, secret + "wrong", 101)).toThrow();
  });

  it("expires exactly at sixty seconds and rejects future-issued tickets", () => {
    const ticket = sealHandoff(payload, secret, 100);
    expect(openHandoff(ticket, secret, 100 + HANDOFF_TTL_MS - 1)).toEqual(payload);
    expect(() => openHandoff(ticket, secret, 100 + HANDOFF_TTL_MS)).toThrow();
    expect(() => openHandoff(ticket, secret, 99)).toThrow();
  });

  it.each([null, {}, "x".repeat(4097), "bad.ticket", "a"])("rejects malformed ticket %p", (ticket) => {
    expect(() => openHandoff(ticket, secret)).toThrow();
  });

  it("requires the original PKCE verifier", () => {
    expect(matchesVerifier(challenge, verifier)).toBe(true);
    expect(matchesVerifier(challenge, "y".repeat(43))).toBe(false);
    expect(matchesVerifier(challenge, "short")).toBe(false);
    expect(matchesVerifier(challenge, "x".repeat(129))).toBe(false);
  });
});

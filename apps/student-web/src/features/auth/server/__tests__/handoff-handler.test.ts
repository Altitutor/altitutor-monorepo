/** @jest-environment node */
import { loadStudentPortalAccess } from "../portal-access";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { exchangeNativeHandoff, issueNativeHandoff } from "../handoff-handler";
import { sealHandoff } from "../handoff-ticket";

jest.mock("../portal-access", () => ({ loadStudentPortalAccess: jest.fn() }));
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));

const secret = "test-secret-over-thirty-two-characters";
const verifier = "x".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const user = {
  id: "verified-user",
  email: "student@example.test",
  email_confirmed_at: "2026-01-01",
};
const getUser = jest.fn();
const generateLink = jest.fn();
const verifyOtp = jest.fn();
const auth = { getUser, verifyOtp, admin: { generateLink } };

function request(input: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://student.example.test/api/auth/native/ticket", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(input),
  });
}

const origin = { origin: "https://student.example.test" };
const ticket = () =>
  sealHandoff(
    { purpose: "native", userId: user.id, tokenHash: "one-use", challenge },
    secret,
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadStudentPortalAccess).mockResolvedValue({
    status: "allowed",
    userId: user.id,
    studentId: "student-id",
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  jest.mocked(createClient).mockReturnValue({ auth } as never);
  jest.mocked(createServerClient).mockReturnValue({ auth } as never);
  getUser.mockResolvedValue({ data: { user }, error: null });
  generateLink.mockResolvedValue({
    data: { user, properties: { hashed_token: "one-use" } },
    error: null,
  });
  verifyOtp.mockResolvedValue({
    data: {
      user,
      session: { user, access_token: "new-access", refresh_token: "new-refresh" },
    },
    error: null,
  });
});

describe("native handoff issuance", () => {
  it("requires cookie auth plus same origin", async () => {
    for (const headers of [
      {},
      { origin: "https://evil.test" },
      { origin: "https://student.example.test", authorization: "Bearer caller" },
    ] as Record<string, string>[]) {
      expect((await issueNativeHandoff(request({ challenge }, headers))).status).toBe(403);
    }
    expect(getUser).not.toHaveBeenCalled();
    expect((await issueNativeHandoff(request({ challenge, email: "attacker@example.test" }, origin))).status).toBe(200);
    expect(getUser).toHaveBeenCalledWith();
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: user.email });
  });

  it("preserves refreshed source browser cookies while issuing a ticket", async () => {
    jest.mocked(createServerClient).mockImplementation(
      (_url, _key, options) =>
        ({
          auth: {
            getUser: async () => {
              if ("setAll" in options.cookies)
                await options.cookies.setAll?.(
                  [{ name: "student-auth.0", value: "refreshed-source-session", options: { path: "/" } }],
                  {},
                );
              return getUser();
            },
          },
        }) as never,
    );
    const response = await issueNativeHandoff(request({ challenge }, origin));
    expect(response.status).toBe(200);
    expect(response.cookies.get("student-auth.0")?.value).toBe("refreshed-source-session");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("rejects unverified and anonymous users", async () => {
    for (const invalid of [
      { ...user, email_confirmed_at: null },
      { ...user, is_anonymous: true },
    ]) {
      getUser.mockResolvedValue({ data: { user: invalid }, error: null });
      expect((await issueNativeHandoff(request({ challenge }, origin))).status).toBe(401);
    }
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("blocks accounts that are not students", async () => {
    for (const access of [
      { status: "denied" as const },
      { status: "redirect_admin" as const },
      { status: "redirect_tutor" as const },
      { status: "unavailable" as const },
      { status: "unauthenticated" as const },
    ]) {
      jest.mocked(loadStudentPortalAccess).mockResolvedValue(access);
      expect((await issueNativeHandoff(request({ challenge }, origin))).status).toBe(403);
    }
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("rejects malformed challenges before generating a link", async () => {
    expect((await issueNativeHandoff(request({ challenge: "bad" }, origin))).status).toBe(400);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("rejects generated links for a different user and redacts provider errors", async () => {
    generateLink.mockResolvedValue({
      data: { user: { id: "wrong-user" } },
      error: new Error("SECRET provider detail"),
    });
    const response = await issueNativeHandoff(request({ challenge }, origin));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("SECRET");
  });
});

describe("native handoff exchange", () => {
  it("checks verifier before consuming the one-time OTP", async () => {
    expect((await exchangeNativeHandoff(request({ ticket: ticket(), verifier: "y".repeat(43) }))).status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
    const response = await exchangeNativeHandoff(request({ ticket: ticket(), verifier }));
    expect(await response.json()).toEqual({
      access_token: "new-access",
      refresh_token: "new-refresh",
    });
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "one-use" });
  });

  it("rejects reuse when Supabase reports the OTP consumed", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("expired OTP secret"),
    });
    const response = await exchangeNativeHandoff(request({ ticket: ticket(), verifier }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("secret");
  });

  it("rejects a mismatched returned identity", async () => {
    verifyOtp.mockResolvedValue({
      data: {
        user: { id: "wrong-user" },
        session: { user, access_token: "new-access", refresh_token: "new-refresh" },
      },
      error: null,
    });
    expect((await exchangeNativeHandoff(request({ ticket: ticket(), verifier }))).status).toBe(400);
  });
});

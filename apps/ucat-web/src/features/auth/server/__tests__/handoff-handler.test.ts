/** @jest-environment node */
import { resolveUcatPortalAccess } from "../portal-access";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { exchangeHandoff, issueHandoff } from "../handoff-handler";
import { sealHandoff } from "../handoff-ticket";
jest.mock("../portal-access", () => ({ resolveUcatPortalAccess: jest.fn() }));
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
const getUserById = jest.fn();
const verifyOtp = jest.fn();
const auth = { getUser, verifyOtp, admin: { generateLink, getUserById } };
function request(input: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://ucat.example.test/api/auth/handoff", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(input),
  });
}
const origin = { origin: "https://ucat.example.test" };
const bearer = { authorization: "Bearer caller-access" };
function ticket(purpose: "native" | "browser") {
  return sealHandoff(
    purpose === "native"
      ? { purpose, userId: user.id, tokenHash: "one-use", challenge }
      : {
          purpose,
          userId: user.id,
          tokenHash: "one-use",
          path: "/settings/profile",
        },
    secret,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveUcatPortalAccess).mockResolvedValue({
    status: "allowed",
    access: {
      studentId: "student-id",
      activeStaffRole: null,
      signupCompleted: true,
      hasUcatAccess: true,
    },
  } as never);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  jest.mocked(createClient).mockReturnValue({ auth } as never);
  jest.mocked(createServerClient).mockReturnValue({ auth } as never);
  getUser.mockResolvedValue({ data: { user }, error: null });
  getUserById.mockResolvedValue({ data: { user }, error: null });
  generateLink.mockResolvedValue({
    data: { user, properties: { hashed_token: "one-use" } },
    error: null,
  });
  verifyOtp.mockResolvedValue({
    data: {
      user,
      session: {
        user,
        access_token: "new-access",
        refresh_token: "new-refresh",
      },
    },
    error: null,
  });
});
describe("handoff issuance", () => {
  it("requires cookie auth plus same origin for native tickets", async () => {
    for (const headers of [
      {},
      { origin: "https://evil.test" },
      { ...origin, ...bearer },
    ] as Record<string, string>[]) {
      expect(
        (await issueHandoff(request({ challenge }, headers), "native")).status,
      ).toBe(403);
    }
    expect(getUser).not.toHaveBeenCalled();
    expect(
      (await issueHandoff(request({ challenge }, origin), "native")).status,
    ).toBe(200);
    expect(getUser).toHaveBeenCalledWith();
  });
  it("preserves refreshed source browser cookies while issuing a native ticket", async () => {
    jest.mocked(createServerClient).mockImplementation(
      (_url, _key, options) =>
        ({
          auth: {
            getUser: async () => {
              if ("setAll" in options.cookies)
                await options.cookies.setAll?.(
                  [
                    {
                      name: "student-auth.0",
                      value: "refreshed-source-session",
                      options: { path: "/" },
                    },
                  ],
                  {},
                );
              return getUser();
            },
          },
        }) as never,
    );
    const response = await issueHandoff(
      request({ challenge }, origin),
      "native",
    );
    expect(response.status).toBe(200);
    expect(response.cookies.get("student-auth.0")?.value).toBe(
      "refreshed-source-session",
    );
  });
  it("requires bearer auth for browser tickets even with browser cookies", async () => {
    expect(
      (
        await issueHandoff(
          request(
            { path: "/settings/profile" },
            { cookie: "student-auth=value" },
          ),
          "browser",
        )
      ).status,
    ).toBe(401);
    const response = await issueHandoff(
      request(
        { path: "/settings/profile", email: "attacker@example.test" },
        bearer,
      ),
      "browser",
    );
    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith("caller-access");
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: user.email,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("rejects unverified and anonymous users", async () => {
    for (const invalid of [
      { ...user, email_confirmed_at: null },
      { ...user, is_anonymous: true },
    ]) {
      getUser.mockResolvedValue({ data: { user: invalid }, error: null });
      expect(
        (await issueHandoff(request({ challenge }, origin), "native")).status,
      ).toBe(401);
    }
    expect(generateLink).not.toHaveBeenCalled();
  });
  it("blocks incomplete signup and staff portal accounts", async () => {
    for (const access of [
      { studentId: "student", signupCompleted: false, hasUcatAccess: true },
      {
        studentId: "student",
        signupCompleted: true,
        activeStaffRole: "TUTOR",
        hasUcatAccess: true,
      },
    ]) {
      jest
        .mocked(resolveUcatPortalAccess)
        .mockResolvedValue({ status: "allowed", access } as never);
      expect(
        (await issueHandoff(request({ challenge }, origin), "native")).status,
      ).toBe(403);
    }
    expect(generateLink).not.toHaveBeenCalled();
  });
  it("rejects malformed challenges and open redirects before generating a link", async () => {
    expect(
      (await issueHandoff(request({ challenge: "bad" }, origin), "native"))
        .status,
    ).toBe(400);
    expect(
      (await issueHandoff(request({ path: "//evil.test" }, bearer), "browser"))
        .status,
    ).toBe(400);
    expect(generateLink).not.toHaveBeenCalled();
  });
  it("rejects generated links for a different user and redacts provider errors", async () => {
    generateLink.mockResolvedValue({
      data: { user: { id: "wrong-user" } },
      error: new Error("SECRET provider detail"),
    });
    const response = await issueHandoff(
      request({ challenge }, origin),
      "native",
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("SECRET");
  });
});
describe("handoff exchange", () => {
  it("checks verifier before consuming the one-time OTP", async () => {
    expect(
      (
        await exchangeHandoff(
          request({ ticket: ticket("native"), verifier: "y".repeat(43) }),
          "native",
        )
      ).status,
    ).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
    const response = await exchangeHandoff(
      request({ ticket: ticket("native"), verifier }),
      "native",
    );
    expect(await response.json()).toEqual({
      access_token: "new-access",
      refresh_token: "new-refresh",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "one-use",
    });
  });
  it("rejects reuse when Supabase reports the OTP consumed", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("expired OTP secret"),
    });
    const response = await exchangeHandoff(
      request({ ticket: ticket("native"), verifier }),
      "native",
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("secret");
  });
  it("rejects cross-purpose redemption and mismatched returned identity", async () => {
    expect(
      (
        await exchangeHandoff(
          request({ ticket: ticket("browser"), verifier }),
          "native",
        )
      ).status,
    ).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
    verifyOtp.mockResolvedValue({
      data: {
        user: { id: "wrong-user" },
        session: {
          user,
          access_token: "new-access",
          refresh_token: "new-refresh",
        },
      },
      error: null,
    });
    expect(
      (
        await exchangeHandoff(
          request({ ticket: ticket("native"), verifier }),
          "native",
        )
      ).status,
    ).toBe(400);
  });
  it.each([null, { ...user, id: "different-browser-user" }])(
    "requires consent for browser identity %p without consuming OTP",
    async (current) => {
      getUser.mockResolvedValue({ data: { user: current }, error: null });
      const response = await exchangeHandoff(
        request({ ticket: ticket("browser") }, origin),
        "browser",
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        confirmationRequired: true,
        email: user.email,
      });
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.cookies.getAll()).toEqual([]);
      expect(getUserById).toHaveBeenCalledWith(user.id);
    },
  );
  it("automatically exchanges only when the verified browser account matches", async () => {
    const response = await exchangeHandoff(
      request({ ticket: ticket("browser") }, origin),
      "browser",
    );
    expect(await response.json()).toEqual({ path: "/settings/profile" });
    expect(getUser).toHaveBeenCalled();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(getUserById).not.toHaveBeenCalled();
  });
  it("explicit confirmed consent exchanges without trusting the existing browser identity", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await exchangeHandoff(
      request({ ticket: ticket("browser"), confirmed: true }, origin),
      "browser",
    );
    expect(await response.json()).toEqual({ path: "/settings/profile" });
    expect(getUser).not.toHaveBeenCalled();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });
  it("does not treat a truthy string as consent", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await exchangeHandoff(
      request({ ticket: ticket("browser"), confirmed: "true" }, origin),
      "browser",
    );
    expect(await response.json()).toEqual({
      confirmationRequired: true,
      email: user.email,
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it("publishes SSR cookies only after identity validation and never reuses caller cookies", async () => {
    jest.mocked(createServerClient).mockImplementation(
      (_url, _key, options) =>
        ({
          auth: {
            verifyOtp: async () => {
              if ("setAll" in options.cookies)
                await options.cookies.setAll?.(
                  [
                    {
                      name: "student-auth.0",
                      value: "new-session-cookie",
                      options: { path: "/", sameSite: "lax" },
                    },
                  ],
                  {},
                );
              return verifyOtp();
            },
          },
        }) as never,
    );
    const valid = await exchangeHandoff(
      request({ ticket: ticket("browser"), confirmed: true }, origin),
      "browser",
    );
    expect(valid.cookies.get("student-auth.0")?.value).toBe(
      "new-session-cookie",
    );
    expect(await valid.text()).not.toContain("new-session-cookie");
    verifyOtp.mockResolvedValue({
      data: {
        user: { id: "wrong" },
        session: { user, access_token: "secret", refresh_token: "secret" },
      },
      error: null,
    });
    const invalid = await exchangeHandoff(
      request({ ticket: ticket("browser"), confirmed: true }, origin),
      "browser",
    );
    expect(invalid.status).toBe(400);
    expect(invalid.cookies.getAll()).toEqual([]);
  });
  it("browser exchange requires same origin, ignores incoming cookies, returns only destination", async () => {
    expect(
      (await exchangeHandoff(request({ ticket: ticket("browser") }), "browser"))
        .status,
    ).toBe(403);
    const response = await exchangeHandoff(
      request(
        { ticket: ticket("browser") },
        { ...origin, cookie: "student-auth.0=old-session" },
      ),
      "browser",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "/settings/profile" });
    const options = jest.mocked(createServerClient).mock.calls.at(-1)?.[2];
    expect(
      options?.cookies &&
        "getAll" in options.cookies &&
        options.cookies.getAll?.(),
    ).toEqual([]);
    expect(response.cookies.get("student-auth.0")?.value).toBe("");
  });
});

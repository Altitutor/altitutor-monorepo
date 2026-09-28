/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { exchangeBrowserHandoff, issueBrowserHandoff } from "../browser-handoff-handler";
import { sealBrowserHandoff } from "../browser-handoff-ticket";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));

const secret = "test-secret-over-thirty-two-characters";
const user = {
  id: "verified-user",
  email: "student@example.test",
  email_confirmed_at: "2026-01-01",
};
const getUser = jest.fn();
const rpc = jest.fn();
const generateLink = jest.fn();
const getUserById = jest.fn();
const verifyOtp = jest.fn();

function request(url: string, input: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(input),
  });
}

const bearer = { authorization: "Bearer app-token" };
const origin = { origin: "https://student.example.test" };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  jest.mocked(createClient).mockImplementation((_url, key) =>
    key === secret
      ? ({ auth: { admin: { generateLink, getUserById } } } as never)
      : ({ auth: { getUser }, rpc } as never),
  );
  jest.mocked(createServerClient).mockReturnValue({ auth: { getUser, verifyOtp } } as never);
  getUser.mockResolvedValue({ data: { user }, error: null });
  rpc.mockResolvedValue({ data: { student_id: "student-id", active_staff_role: null }, error: null });
  generateLink.mockResolvedValue({
    data: { user, properties: { hashed_token: "one-use" } },
    error: null,
  });
  getUserById.mockResolvedValue({ data: { user }, error: null });
  verifyOtp.mockResolvedValue({
    data: {
      user,
      session: { user, access_token: "new-access", refresh_token: "new-refresh" },
    },
    error: null,
  });
});

describe("browser handoff", () => {
  it("issues a profile ticket only for a bearer-authenticated student", async () => {
    const denied = await issueBrowserHandoff(
      request("https://student.example.test/api/auth/browser/ticket", { path: "/settings/profile" }),
    );
    expect(denied.status).toBe(401);

    const wrongPath = await issueBrowserHandoff(
      request("https://student.example.test/api/auth/browser/ticket", { path: "/billing" }, bearer),
    );
    expect(wrongPath.status).toBe(400);

    const response = await issueBrowserHandoff(
      request("https://student.example.test/api/auth/browser/ticket", { path: "/settings/profile" }, bearer),
    );
    expect(response.status).toBe(200);
    expect(typeof (await response.json()).ticket).toBe("string");
    expect(getUser).toHaveBeenCalledWith("app-token");
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: user.email });
  });

  it("asks before replacing a different browser session, then opens profile", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("missing") });
    const ticket = sealBrowserHandoff(
      { purpose: "browser", userId: user.id, tokenHash: "one-use", path: "/settings/profile" },
      secret,
    );
    const confirm = await exchangeBrowserHandoff(
      request("https://student.example.test/api/auth/browser/exchange", { ticket }, origin),
    );
    expect(confirm.status).toBe(200);
    expect(await confirm.json()).toEqual({ confirmationRequired: true, email: user.email });
    expect(verifyOtp).not.toHaveBeenCalled();

    getUser.mockResolvedValue({ data: { user }, error: null });
    const opened = await exchangeBrowserHandoff(
      request(
        "https://student.example.test/api/auth/browser/exchange",
        { ticket, confirmed: true },
        origin,
      ),
    );
    expect(await opened.json()).toEqual({ path: "/settings/profile" });
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "one-use" });
  });

  it("rejects cross-origin exchange and native tickets", async () => {
    const ticket = sealBrowserHandoff(
      { purpose: "browser", userId: user.id, tokenHash: "one-use", path: "/settings/profile" },
      secret,
    );
    expect(
      (
        await exchangeBrowserHandoff(
          request("https://student.example.test/api/auth/browser/exchange", { ticket, confirmed: true }, {
            origin: "https://evil.test",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await exchangeBrowserHandoff(
          request("https://student.example.test/api/auth/browser/exchange", { ticket: "native-ticket", confirmed: true }, origin),
        )
      ).status,
    ).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

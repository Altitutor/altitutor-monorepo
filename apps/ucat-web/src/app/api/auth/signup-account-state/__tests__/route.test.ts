/** @jest-environment node */

import type { NextRequest } from "next/server";
import { POST } from "../route";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: jest.fn() },
}));

const mockedRpc = jest.mocked(supabaseAdmin!.rpc);

function request(email: string): NextRequest {
  return {
    json: async () => ({ email }),
    headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
  } as unknown as NextRequest;
}

describe("POST /api/auth/signup-account-state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only the confirmed account state for a normalized email", async () => {
    mockedRpc.mockResolvedValue({
      data: "confirmed",
      error: null,
    } as never);

    const response = await POST(request(" Existing@Example.com "));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: "confirmed" });
    expect(mockedRpc).toHaveBeenCalledWith(
      "resolve_ucat_signup_email_state",
      expect.objectContaining({ p_email: "existing@example.com" }),
    );
  });

  it("returns 429 when account discovery is rate limited", async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: { message: "signup_email_lookup_rate_limited" },
    } as never);

    const response = await POST(request("student@example.com"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many attempts. Please try again shortly.",
    });
  });

  it("uses one public state for absent and unconfirmed accounts", async () => {
    mockedRpc.mockResolvedValue({ data: "available", error: null } as never);

    const response = await POST(request("unfinished@example.com"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: "available" });
  });
});

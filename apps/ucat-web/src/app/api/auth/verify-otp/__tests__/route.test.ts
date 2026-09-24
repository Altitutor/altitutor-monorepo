/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const verifyOtp = jest.fn();

describe("POST /api/auth/verify-otp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerClient.mockResolvedValue({
      auth: { verifyOtp },
    } as never);
  });

  it("establishes the OTP session with the server client", async () => {
    verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: "access", refresh_token: "refresh" },
        user: { id: "user-1" },
      },
      error: null,
    });

    const response = await POST({
      json: async () => ({
        email: " Student@Example.com ",
        token: "123456",
      }),
    } as unknown as NextRequest);

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "student@example.com",
      token: "123456",
      type: "email",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: null });
  });

  it("does not report success when Supabase returns no session", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    const response = await POST({
      json: async () => ({
        email: "student@example.com",
        token: "123456",
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({ code: "signup_session_missing" }),
    });
  });
});

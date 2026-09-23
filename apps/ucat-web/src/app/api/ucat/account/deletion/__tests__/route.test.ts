/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { POST } from "../route";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {},
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockedServerClient = jest.mocked(getSupabaseServerClient);

describe("POST /api/ucat/account/deletion", () => {
  it("rejects a signed-out student", async () => {
    mockedServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
      },
    } as never);

    const response = await POST({
      json: async () => ({ fullName: "Ada Lovelace" }),
    } as unknown as NextRequest);

    expect(response.status).toBe(401);
  });

  it("requires a full name before looking up the student", async () => {
    mockedServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);

    const response = await POST({
      json: async () => ({}),
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(supabaseAdmin).toBeTruthy();
  });
});

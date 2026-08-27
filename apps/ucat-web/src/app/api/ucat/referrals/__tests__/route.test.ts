/** @jest-environment node */

import { GET } from "../route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStudentIdForUser } from "@/lib/ucat/ucat-subscription";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/lib/ucat/ucat-subscription", () => ({
  getStudentIdForUser: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockServerClient = jest.mocked(getSupabaseServerClient);
const mockGetStudentId = jest.mocked(getStudentIdForUser);
const mockFrom = jest.mocked(supabaseAdmin!.from);

function selectedRows(data: unknown) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(async () => ({ data, error: null })),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data, error: null }),
      })),
    })),
  };
}

describe("GET /api/ucat/referrals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);
    mockGetStudentId.mockResolvedValue("student-1");
  });

  it("creates the share code idempotently without provoking a duplicate-key response", async () => {
    const upsert = jest.fn(async () => ({ data: null, error: null }));
    mockFrom
      .mockReturnValueOnce({ upsert } as never)
      .mockReturnValueOnce(selectedRows({ code: "ABCD1234" }) as never)
      .mockReturnValueOnce(selectedRows([]) as never)
      .mockReturnValueOnce(selectedRows([]) as never)
      .mockReturnValueOnce(selectedRows([]) as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      { student_id: "student-1" },
      { onConflict: "student_id", ignoreDuplicates: true },
    );
    await expect(response.json()).resolves.toMatchObject({ code: "ABCD1234" });
  });
});

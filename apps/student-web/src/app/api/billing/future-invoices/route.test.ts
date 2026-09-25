import { GET } from "./route";
import { loadFutureInvoicePreviews } from "@/features/billing/server/future-invoices";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) => ({
      status: init?.status ?? 200,
      headers: init?.headers,
      json: async () => body,
    }),
  },
}));

jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseAdmin: jest.fn(),
}));

jest.mock("@/features/billing/server/future-invoices", () => ({
  loadFutureInvoicePreviews: jest.fn(),
}));

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);
const mockedGetServerSupabaseAdmin = jest.mocked(getServerSupabaseAdmin);
const mockedLoadFutureInvoicePreviews = jest.mocked(loadFutureInvoicePreviews);

describe("GET /api/billing/future-invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests before accessing billing data", async () => {
    mockedCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockedGetServerSupabaseAdmin).not.toHaveBeenCalled();
    expect(mockedLoadFutureInvoicePreviews).not.toHaveBeenCalled();
  });

  it("returns previews for the authenticated student", async () => {
    mockedCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: jest.fn((name: string) =>
        Promise.resolve({
          data: name === "is_student" ? true : "student-1",
          error: null,
        }),
      ),
    } as unknown as ReturnType<typeof createClient>);
    const admin = {} as ReturnType<typeof getServerSupabaseAdmin>;
    mockedGetServerSupabaseAdmin.mockReturnValue(admin);
    mockedLoadFutureInvoicePreviews.mockResolvedValue([
      {
        sessions_students_id: "assignment-1",
        subject_id: "subject-1",
        session_name: "Mathematics A - Thursday, 1 October 2026, 10:30 am",
        session_start_at: "2026-10-01T00:00:00.000Z",
        full_amount_cents: 8_000,
        prior_charge_cents: 0,
        currency: "aud",
        is_first_in_currency: true,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      future_invoices: [
        {
          session_name: "Mathematics A - Thursday, 1 October 2026, 10:30 am",
        },
      ],
    });
    expect(mockedLoadFutureInvoicePreviews).toHaveBeenCalledWith(
      admin,
      "student-1",
    );
    expect(response.headers).toEqual({ "Cache-Control": "private, no-store" });
  });
});

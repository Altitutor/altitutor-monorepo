import { GET } from "./route";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";

const mockRetrieveCustomer = jest.fn();

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

jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    customers: { retrieve: mockRetrieveCustomer },
  })),
}));

jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseAdmin: jest.fn(),
}));

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);
const mockedGetServerSupabaseAdmin = jest.mocked(getServerSupabaseAdmin);
const mockedCaptureApiError = jest.mocked(captureApiError);

function mockAuthenticatedStudent(studentId = "student-123") {
  mockedCreateClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    rpc: jest.fn((name: string) => {
      if (name === "is_student") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: studentId, error: null });
    }),
  } as unknown as ReturnType<typeof createClient>);
}

function mockBillingCustomer(stripeCustomerId: string | null) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : null,
    error: null,
  });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));

  mockedGetServerSupabaseAdmin.mockReturnValue({
    from,
  } as unknown as ReturnType<typeof getServerSupabaseAdmin>);

  return { from, eq };
}

describe("GET /api/billing/credit-balance", () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
    jest.restoreAllMocks();
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
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockedGetServerSupabaseAdmin).not.toHaveBeenCalled();
    expect(mockRetrieveCustomer).not.toHaveBeenCalled();
  });

  it("returns a zero balance when the student has no linked Stripe customer", async () => {
    mockAuthenticatedStudent();
    mockBillingCustomer(null);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      linked: false,
      balance_cents: 0,
      currency: "aud",
    });
    expect(response.headers).toEqual({ "Cache-Control": "private, no-store" });
    expect(mockRetrieveCustomer).not.toHaveBeenCalled();
  });

  it("returns the authenticated student Stripe balance without changing its sign", async () => {
    mockAuthenticatedStudent("student-123");
    const { eq } = mockBillingCustomer("cus_123");
    mockRetrieveCustomer.mockResolvedValue({
      id: "cus_123",
      deleted: false,
      balance: -4250,
      currency: "aud",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      linked: true,
      balance_cents: -4250,
      currency: "aud",
    });
    expect(eq).toHaveBeenCalledWith("student_id", "student-123");
    expect(mockRetrieveCustomer).toHaveBeenCalledWith("cus_123");
    expect(response.headers).toEqual({ "Cache-Control": "private, no-store" });
  });

  it("captures Stripe failures without exposing their details", async () => {
    mockAuthenticatedStudent();
    mockBillingCustomer("cus_123");
    const stripeError = new Error("Stripe connection failed");
    mockRetrieveCustomer.mockRejectedValue(stripeError);

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load credit balance",
    });
    expect(mockedCaptureApiError).toHaveBeenCalledWith(
      stripeError,
      "/api/billing/credit-balance",
    );
  });
});

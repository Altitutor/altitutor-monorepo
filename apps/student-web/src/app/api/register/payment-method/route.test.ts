import { POST } from "./route";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getServerSupabaseClient } from "@/shared/lib/supabase/server";
import type { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseClient: jest.fn(),
}));

const mockedGetServerSupabaseClient = jest.mocked(getServerSupabaseClient);
const mockedCaptureApiError = jest.mocked(captureApiError);

function paymentMethodRequest() {
  return {
    json: async () => ({
      action: "verify_payment_method",
      token: "registration-token",
    }),
  } as NextRequest;
}

describe("POST /api/register/payment-method", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns an uncaptured pending result while the payment-method webhook is pending", async () => {
    const pendingResponse = {
      status: 400,
      clone: () => pendingResponse,
      json: async () => ({ verified: false, error: "No payment method found" }),
    };

    mockedGetServerSupabaseClient.mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: null,
          error: {
            name: "FunctionsHttpError",
            message: "Edge Function returned a non-2xx status code",
            context: pendingResponse,
          },
        }),
      },
    } as unknown as ReturnType<typeof getServerSupabaseClient>);

    const response = await POST(paymentMethodRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      verified: false,
      code: "webhook_pending",
    });
    expect(mockedCaptureApiError).not.toHaveBeenCalled();
  });

  it("continues to capture and reject real payment-service failures", async () => {
    const serviceError = new Error("Payment service unavailable");
    mockedGetServerSupabaseClient.mockReturnValue({
      functions: {
        invoke: jest
          .fn()
          .mockResolvedValue({ data: null, error: serviceError }),
      },
    } as unknown as ReturnType<typeof getServerSupabaseClient>);

    const response = await POST(paymentMethodRequest());

    expect(response.status).toBe(500);
    expect(mockedCaptureApiError).toHaveBeenCalledWith(
      serviceError,
      "/api/register/payment-method",
      {
        journey: "student_registration",
        registration_stage: "payment_method_service",
        result_code: "edge_function_error",
      },
    );
  });

  it("does not normalize other payment-service 400 responses", async () => {
    const invalidTokenResponse = {
      status: 400,
      clone: () => invalidTokenResponse,
      json: async () => ({ error: "Invalid or expired registration token" }),
    };
    const invalidTokenError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: invalidTokenResponse,
    };

    mockedGetServerSupabaseClient.mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: null,
          error: invalidTokenError,
        }),
      },
    } as unknown as ReturnType<typeof getServerSupabaseClient>);

    const response = await POST(paymentMethodRequest());

    expect(response.status).toBe(500);
    expect(mockedCaptureApiError).toHaveBeenCalledWith(
      invalidTokenError,
      "/api/register/payment-method",
      {
        journey: "student_registration",
        registration_stage: "payment_method_service",
        result_code: "edge_function_error",
      },
    );
  });
});

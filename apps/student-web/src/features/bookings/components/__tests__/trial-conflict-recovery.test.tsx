import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NextRequest } from "next/server";
import BookTrialPage from "@/app/booking/trial-session/page";
import { POST } from "@/app/api/bookings/trial/public/route";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { capturePublicBookingOutcome } from "@/features/bookings/lib/capture-public-booking-outcome";
import type { TrialContactFormValues } from "../TrialContactForm";

Object.assign(globalThis, { React });

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockToast = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
const mockSearchParams = new URLSearchParams({
  step: "2",
  time: "2099-01-01T00:00:00.000Z/2099-01-01T00:45:00.000Z",
});

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      json: async () => body,
    }),
  },
}));

jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui/components/button"),
  ...jest.requireActual("@altitutor/ui/components/card"),
  ...jest.requireActual("@altitutor/ui/components/badge"),
  ...jest.requireActual("@altitutor/ui/components/label"),
  ...jest.requireActual("@altitutor/ui/components/radio-group"),
  ...jest.requireActual("@altitutor/ui/lib/clickable-card-styles"),
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseAdmin: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/features/bookings/lib/capture-public-booking-outcome", () => ({
  capturePublicBookingOutcome: jest.fn(),
}));
jest.mock("@/shared/lib/analytics/posthog", () => ({
  captureStudentEvent: jest.fn(),
  captureStudentEventWhenReady: jest.fn(),
  posthogIdentityHeaders: () => ({}),
}));
jest.mock("@/features/bookings/hooks/useBookingSettings", () => ({
  useSessionDurationMinutes: () => ({ data: 45 }),
  useMinAdvanceBookingDays: () => ({ data: 1 }),
}));
jest.mock("../TimeSlotPicker", () => ({ TimeSlotPicker: () => null }));
jest.mock("../TrialContactForm", () => ({
  TrialContactForm: ({
    onSubmit,
  }: {
    onSubmit: (data: TrialContactFormValues) => void;
  }) => (
    <button
      onClick={() =>
        onSubmit({
          student_first_name: "Existing",
          student_email: "existing@student.test",
          curriculum: "SACE",
          year_level: "12",
          subject_ids: [],
          skip_parent_details: true,
        })
      }
    >
      Submit contact details
    </button>
  ),
}));

// Exercise the actual route response, booking submission handler, wizard, and
// recovery actions together. Only upstream data entry and external services are
// replaced; this test does not create a booking or send a notification.
describe("existing-student public trial recovery", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    { code: "P0001", message: "STUDENT_EXISTS" },
    {
      code: "23505",
      message: "duplicate key violates unique constraint students_email_key",
    },
  ])(
    "provides login/contact recovery for $code without confirming a booking",
    async (error) => {
      const rpc = jest.fn().mockResolvedValue({ data: null, error });
      jest
        .mocked(getServerSupabaseAdmin)
        .mockReturnValue({ rpc } as unknown as ReturnType<
          typeof getServerSupabaseAdmin
        >);
      const responses: number[] = [];
      global.fetch = jest.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          const body: unknown = JSON.parse(String(init?.body));
          const response = await POST({
            json: async () => body,
            headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
          } as NextRequest);
          responses.push(response.status);
          return response;
        },
      );

      render(<BookTrialPage />);
      fireEvent.click(
        screen.getByRole("button", { name: "Submit contact details" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm Booking" }));

      await screen.findByRole("heading", { name: "Already a Student?" });
      expect(responses).toEqual([409]);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        "create_public_trial_booking",
        expect.objectContaining({
          p_student_email: "existing@student.test",
          p_session_type: "TRIAL_SESSION",
        }),
      );
      expect(screen.getByRole("link", { name: "Contact Us" })).toHaveAttribute(
        "href",
        "https://altitutor.com/contact-us",
      );

      fireEvent.click(screen.getByRole("button", { name: "Log In" }));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem("trial_booking_data")).toBeNull();
      expect(mockToast).not.toHaveBeenCalled();
      expect(capturePublicBookingOutcome).not.toHaveBeenCalled();
      expect(captureApiError).not.toHaveBeenCalled();
    },
  );
});

import React from "react";
import { render, screen } from "@testing-library/react";
import BookingSuccessPage from "@/app/booking-success/page";

Object.assign(globalThis, { React });

jest.mock('@altitutor/ui', () => ({
  ...jest.requireActual('@altitutor/ui/components/button'),
  ...jest.requireActual('@altitutor/ui/components/card'),
  ...jest.requireActual('@altitutor/ui/components/badge'),
}));

jest.mock('@/shared/utils/calendar', () => ({ downloadCalendarEvent: jest.fn() }));

const searchParams = new URLSearchParams({
  sessionId: "synthetic-booking-token",
});
jest.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("@/features/bookings/hooks/useBookingSettings", () => ({
  useMinAdvanceBookingDays: () => ({ data: 1 }),
}));
jest.mock("../ChangeSessionDialog", () => ({
  ChangeSessionDialog: () => null,
}));
jest.mock("../CancelBookingDialog", () => ({
  CancelBookingDialog: () => null,
}));

const booking = {
  session_id: "synthetic-session",
  booking_token: "synthetic-booking-token",
  session_type: "TRIAL_SESSION",
  status: "ACTIVE",
  start_at: "2099-01-01T04:50:00Z",
  end_at: "2099-01-01T05:30:00Z",
  student_first_name: "First",
  student_last_name: "Student",
  student_email: "first@example.test",
  curriculum: "SACE",
};

describe("shared booking confirmation", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("shows both students and explains that management applies to the whole booking", async () => {
    sessionStorage.setItem(
      "trial_booking_data",
      JSON.stringify({
        ...booking,
        students: [
          { first_name: "First", last_name: "Student" },
          { first_name: "Second", last_name: "Student" },
        ],
      }),
    );
    render(<BookingSuccessPage />);
    expect(
      await screen.findByText("First Student, Second Student"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Changes and cancellations apply to everyone in this booking.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change session" }),
    ).toBeEnabled();
  });

  it("still shows single-student confirmation data from the booking form", async () => {
    sessionStorage.setItem("trial_booking_data", JSON.stringify(booking));
    render(<BookingSuccessPage />);
    expect(await screen.findByText("First Student")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Changes and cancellations apply to everyone in this booking.",
      ),
    ).not.toBeInTheDocument();
  });
});

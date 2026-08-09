import {
  buildBookingCancelledEmail,
  buildBookingChangedEmail,
  buildBookingConfirmationEmail,
} from "../index";

describe("buildBookingConfirmationEmail", () => {
  it("renders the canonical booking action after the staff introduction", () => {
    const email = buildBookingConfirmationEmail({
      recipientName: "Sam Lee",
      studentName: "Sam Lee",
      sessionDate: "Monday, 10 August 2026",
      sessionTime: "4:00 pm–5:00 pm",
      bookingUrl: "https://student.altitutor.com/bookings/abc",
      staffIntroduction: "Looking forward to seeing you.",
    });

    expect(email.subject).toBe("Booking confirmation for Sam Lee — Altitutor");
    expect(email.html).toContain("Looking forward to seeing you.");
    expect(email.html).toContain("Monday, 10 August 2026");
    expect(email.html).toContain("4:00 pm–5:00 pm");
    expect(email.html).toContain("View booking confirmation");
    expect(email.text).toContain(
      "View booking confirmation: https://student.altitutor.com/bookings/abc",
    );
  });
});

describe("booking changes", () => {
  it("renders changed and cancelled messages from the same canonical family", () => {
    const changed = buildBookingChangedEmail({
      recipientName: "Sam Lee",
      sessionDate: "Monday, 10 August 2026",
      sessionTime: "4:00 pm–5:00 pm",
      bookingUrl: "https://student.altitutor.com/bookings/abc",
    });
    const cancelled = buildBookingCancelledEmail({
      recipientName: "Sam Lee",
      sessionDate: "Monday, 10 August 2026",
      sessionTime: "4:00 pm–5:00 pm",
    });

    expect(changed.subject).toBe("Your Altitutor session has changed");
    expect(changed.html).toContain("View updated booking");
    expect(cancelled.subject).toBe("Your Altitutor session has been cancelled");
    expect(cancelled.html).toContain("has been cancelled");
    expect(cancelled.html).not.toContain('<a class="email-button"');
    expect(changed.from).toBe(cancelled.from);
  });
});

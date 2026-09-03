import {
  buildInPersonBookingEvent,
  buildPosthogIdentityHeaders,
  IN_PERSON_ANALYTICS_CONTEXT,
  IN_PERSON_BOOKING_EVENTS,
  inPersonBookingInsertId,
  readPosthogIdentityFromHeaders,
} from "../in-person-booking-event";

describe("in-person booking analytics", () => {
  const originalEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;

  afterEach(() => {
    if (originalEnvironment === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = originalEnvironment;
    }
  });

  it("forwards PostHog identity on public booking API calls", () => {
    expect(
      buildPosthogIdentityHeaders({
        distinctId: "anon-1",
        sessionId: "sess-1",
      }),
    ).toEqual({
      "X-POSTHOG-DISTINCT-ID": "anon-1",
      "X-POSTHOG-SESSION-ID": "sess-1",
    });

    expect(
      readPosthogIdentityFromHeaders(
        new Headers({
          "X-POSTHOG-DISTINCT-ID": "anon-1",
          "X-POSTHOG-SESSION-ID": "sess-1",
        }),
      ),
    ).toEqual({ distinctId: "anon-1", sessionId: "sess-1" });
  });

  it("builds a durable booking completion without contact details", () => {
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "preview";

    expect(
      buildInPersonBookingEvent({
        event: IN_PERSON_BOOKING_EVENTS.completed,
        distinctId: "anon-1",
        sessionId: "session-1",
        studentId: "student-1",
        sessionType: "SUBSIDY_INTERVIEW",
        posthogSessionId: "ph-sess-1",
        properties: { curriculum: "SACE", subject_count: 2 },
      }),
    ).toEqual({
      distinctId: "anon-1",
      event: "booking_completed",
      properties: {
        ...IN_PERSON_ANALYTICS_CONTEXT,
        environment: "preview",
        session_id: "session-1",
        session_type: "SUBSIDY_INTERVIEW",
        student_id: "student-1",
        $session_id: "ph-sess-1",
        $insert_id: "in-person:booking_completed:session-1",
        curriculum: "SACE",
        subject_count: 2,
      },
    });
  });

  it("keeps cancellation insert ids stable per session", () => {
    expect(
      inPersonBookingInsertId(IN_PERSON_BOOKING_EVENTS.cancelled, "session-1"),
    ).toBe("in-person:booking_cancelled:session-1");
  });
});

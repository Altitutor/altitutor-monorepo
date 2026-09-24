import {
  buildUcatSignupCompletedEvent,
  type UcatSignupCompletedInput,
} from "@/lib/analytics/ucat-signup-event";

describe("buildUcatSignupCompletedEvent", () => {
  it("uses the auth identity and stable student-level event UUID", () => {
    const input: UcatSignupCompletedInput = {
      userId: "user-1",
      studentId: "student-1",
      completedAt: "2026-08-31T00:00:00.000Z",
      accountClass: "external",
      selfReportedSources: ["reddit", "friend_or_classmate"],
      selfReportedOther: null,
      observedFirstTouch: {
        utmSource: "reddit",
        utmMedium: "organic_social",
        utmCampaign: "ucat_2027_launch",
        utmContent: "founder_comment",
        utmTerm: null,
        referrerDomain: "reddit.com",
        landingPath: "/ucat/",
        capturedAt: "2026-08-30T23:00:00.000Z",
      },
    };
    const event = buildUcatSignupCompletedEvent(input);

    expect(event).toMatchObject({
      distinctId: "user-1",
      event: "signup_completed",
      properties: {
        initial_utm_source: "reddit",
        self_reported_acquisition_sources: [
          "reddit",
          "friend_or_classmate",
        ],
      },
    });
    expect(event.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(buildUcatSignupCompletedEvent(input).uuid).toBe(event.uuid);
  });
});

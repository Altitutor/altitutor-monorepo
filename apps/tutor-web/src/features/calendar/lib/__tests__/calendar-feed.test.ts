import {
  buildTutorCalendarFeed,
  getCalendarEventSequence,
  getCalendarEventTitle,
  shouldIncludeInCalendarFeed,
  type CalendarSession,
} from "../calendar-feed";

const baseSession: CalendarSession = {
  id: "55fceebe-f6a3-4fa8-af26-7407671e05cc",
  type: "CLASS",
  classId: "2ec4609a-8f87-436a-86d0-d91dcbd9f4b0",
  startAt: "2026-07-18T06:45:00.000Z",
  endAt: "2026-07-18T08:15:00.000Z",
  updatedAt: "2026-07-17T01:02:03.000Z",
  status: "ACTIVE",
  subjectLongName: "SACE Stage 2 Mathematical Methods",
  subjectName: "Mathematical Methods",
};

describe("tutor calendar feed", () => {
  it("uses the subject long name for class sessions", () => {
    expect(getCalendarEventTitle(baseSession)).toBe(
      "Altitutor class: SACE Stage 2 Mathematical Methods",
    );
  });

  it("uses a human-readable session type for non-class sessions", () => {
    expect(
      getCalendarEventTitle({
        ...baseSession,
        type: "ADMIN_MEETING",
        classId: null,
      }),
    ).toBe("Altitutor meeting");
  });

  it("creates stable events with UTC times, SEQUENCE, and a session deep link", () => {
    const feed = buildTutorCalendarFeed(
      [baseSession],
      "https://tutor.altitutor.com",
    );
    const unfoldedFeed = feed.replace(/\r\n /g, "");

    expect(unfoldedFeed).toContain(
      "UID:session-55fceebe-f6a3-4fa8-af26-7407671e05cc@altitutor.com",
    );
    expect(unfoldedFeed).toContain("DTSTART:20260718T064500Z");
    expect(unfoldedFeed).toContain("DTEND:20260718T081500Z");
    expect(unfoldedFeed).toContain(
      `SEQUENCE:${getCalendarEventSequence("2026-07-17T01:02:03.000Z")}`,
    );
    expect(unfoldedFeed).toContain("STATUS:CONFIRMED");
    expect(unfoldedFeed).toContain(
      "https://tutor.altitutor.com/classes?session=55fceebe-f6a3-4fa8-af26-7407671e05cc",
    );
    expect(feed.endsWith("\r\n")).toBe(true);
  });

  it("bumps SEQUENCE when a session is rescheduled so clients replace the event", () => {
    const original = buildTutorCalendarFeed(
      [baseSession],
      "https://tutor.altitutor.com",
    );
    const rescheduled = buildTutorCalendarFeed(
      [
        {
          ...baseSession,
          startAt: "2026-07-20T06:45:00.000Z",
          endAt: "2026-07-20T08:15:00.000Z",
          updatedAt: "2026-07-19T12:00:00.000Z",
        },
      ],
      "https://tutor.altitutor.com",
    );

    const originalSequence = getCalendarEventSequence(
      baseSession.updatedAt as string,
    );
    const rescheduledSequence = getCalendarEventSequence(
      "2026-07-19T12:00:00.000Z",
    );

    expect(rescheduledSequence).toBeGreaterThan(originalSequence);
    expect(original).toContain(`SEQUENCE:${originalSequence}`);
    expect(rescheduled).toContain(`SEQUENCE:${rescheduledSequence}`);
    expect(rescheduled).toContain("DTSTART:20260720T064500Z");
  });

  it("emits CANCELLED tombstones for recently inactive sessions", () => {
    const feed = buildTutorCalendarFeed(
      [
        {
          ...baseSession,
          status: "INACTIVE",
          updatedAt: "2026-07-30T12:00:00.000Z",
        },
      ],
      "https://tutor.altitutor.com",
    );

    expect(feed).toContain("STATUS:CANCELLED");
    expect(feed).toContain("TRANSP:TRANSPARENT");
    expect(feed).toContain(
      `SEQUENCE:${getCalendarEventSequence("2026-07-30T12:00:00.000Z")}`,
    );
  });

  it("drops long-cancelled sessions once clients have had time to sync", () => {
    expect(
      shouldIncludeInCalendarFeed(
        {
          status: "INACTIVE",
          updatedAt: "2025-01-01T00:00:00.000Z",
          startAt: "2025-01-01T00:00:00.000Z",
        },
        Date.parse("2026-08-03T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("escapes iCalendar punctuation in text fields", () => {
    const feed = buildTutorCalendarFeed(
      [{ ...baseSession, subjectLongName: "English; Language, Literature" }],
      "https://tutor.altitutor.com",
    );

    expect(feed).toContain("English\\; Language\\, Literature");
  });
});

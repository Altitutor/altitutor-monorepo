import {
  buildTutorCalendarFeed,
  getCalendarEventTitle,
  type CalendarSession,
} from "../calendar-feed";

const baseSession: CalendarSession = {
  id: "55fceebe-f6a3-4fa8-af26-7407671e05cc",
  type: "CLASS",
  classId: "2ec4609a-8f87-436a-86d0-d91dcbd9f4b0",
  startAt: "2026-07-18T06:45:00.000Z",
  endAt: "2026-07-18T08:15:00.000Z",
  updatedAt: "2026-07-17T01:02:03.000Z",
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

  it("creates stable events with UTC times and a session deep link", () => {
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
      "https://tutor.altitutor.com/classes?session=55fceebe-f6a3-4fa8-af26-7407671e05cc",
    );
    expect(feed.endsWith("\r\n")).toBe(true);
  });

  it("escapes iCalendar punctuation in text fields", () => {
    const feed = buildTutorCalendarFeed(
      [{ ...baseSession, subjectLongName: "English; Language, Literature" }],
      "https://tutor.altitutor.com",
    );

    expect(feed).toContain("English\\; Language\\, Literature");
  });
});

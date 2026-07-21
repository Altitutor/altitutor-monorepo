import { buildPracticeStreak } from "../practice-streak";

const now = new Date("2026-07-21T12:00:00.000Z");

describe("buildPracticeStreak", () => {
  it("counts a streak through today", () => {
    const streak = buildPracticeStreak(
      [
        { dateKey: "2026-07-19", questionAttempts: 2 },
        { dateKey: "2026-07-20", questionAttempts: 1 },
        { dateKey: "2026-07-21", questionAttempts: 4 },
      ],
      "UTC",
      now,
    );

    expect(streak.current).toBe(3);
    expect(streak.practicedToday).toBe(true);
    expect(streak.recentDays).toHaveLength(7);
  });

  it("keeps yesterday's streak active until the end of today", () => {
    const streak = buildPracticeStreak(
      [
        { dateKey: "2026-07-19", questionAttempts: 1 },
        { dateKey: "2026-07-20", questionAttempts: 1 },
      ],
      "UTC",
      now,
    );

    expect(streak.current).toBe(2);
    expect(streak.practicedToday).toBe(false);
  });

  it("ignores non-question activity", () => {
    const streak = buildPracticeStreak(
      [{ dateKey: "2026-07-21", questionAttempts: 0 }],
      "UTC",
      now,
    );

    expect(streak.current).toBe(0);
  });
});

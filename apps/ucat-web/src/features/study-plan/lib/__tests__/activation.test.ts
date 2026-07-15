import { inferPreferredMockWeekday } from "@/features/study-plan/lib/activation";

describe("inferPreferredMockWeekday", () => {
  it("chooses the available day with the greatest capacity", () => {
    expect(
      inferPreferredMockWeekday([
        { weekday: 1, maxMinutes: 60 },
        { weekday: 3, maxMinutes: 90 },
        { weekday: 6, maxMinutes: 75 },
      ]),
    ).toBe(3);
  });

  it("prefers a weekend when the greatest capacity is tied", () => {
    expect(
      inferPreferredMockWeekday([
        { weekday: 2, maxMinutes: 120 },
        { weekday: 6, maxMinutes: 120 },
      ]),
    ).toBe(6);
  });
});

import { inferPreferredMockWeekday } from "@/features/study-plan/lib/activation";

describe("inferPreferredMockWeekday", () => {
  it("chooses the earliest available weekday when no weekend is selected", () => {
    expect(
      inferPreferredMockWeekday([
        { weekday: 1 },
        { weekday: 3 },
        { weekday: 4 },
      ]),
    ).toBe(1);
  });

  it("prefers a weekend for a full mock", () => {
    expect(
      inferPreferredMockWeekday([
        { weekday: 2 },
        { weekday: 6 },
      ]),
    ).toBe(6);
  });
});

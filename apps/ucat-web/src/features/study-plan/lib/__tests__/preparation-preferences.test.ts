import { parseStudyPlanProfileInput } from "@/features/study-plan/lib/validation";

const baseProfile = {
  studyPlanEnabled: true,
  targetScore: 2100,
  testYear: 2026,
  testDate: null,
  availableDays: [{ weekday: 1 }],
  preferredMockWeekday: 1,
};

describe("Study plan preparation preferences", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("defaults SJT allocation to a little and accepts all three choices", () => {
    expect(parseStudyPlanProfileInput(baseProfile).sjtPreference).toBe(
      "a_little",
    );
    for (const sjtPreference of [
      "normally",
      "a_little",
      "not_at_all",
    ] as const) {
      expect(
        parseStudyPlanProfileInput({ ...baseProfile, sjtPreference }),
      ).toMatchObject({ sjtPreference });
    }
  });

  it("rejects an unknown SJT allocation", () => {
    expect(() =>
      parseStudyPlanProfileInput({ ...baseProfile, sjtPreference: "often" }),
    ).toThrow("Choose how much standalone SJT practice you want.");
  });

  it("treats the mock weekday as a soft preference outside normal availability", () => {
    expect(
      parseStudyPlanProfileInput({
        ...baseProfile,
        preferredMockWeekday: 6,
      }),
    ).toMatchObject({ preferredMockWeekday: 6 });
  });
});

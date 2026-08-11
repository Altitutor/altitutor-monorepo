import { parseStudyPlanProfileInput } from "@/features/study-plan/lib/validation";

const baseProfile = {
  studyPlanEnabled: true,
  targetScore: 2100,
  testYear: 2026,
  testDate: null,
  availableDays: [{ weekday: 1, maxMinutes: 60 }],
  preferredMockWeekday: 1,
};

describe("parseStudyPlanProfileInput test date validation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("accepts a future test date in the selected year", () => {
    expect(
      parseStudyPlanProfileInput({
        ...baseProfile,
        testDate: "2026-09-15",
      }),
    ).toMatchObject({ testDate: "2026-09-15" });
  });

  it("accepts today as the test date", () => {
    expect(
      parseStudyPlanProfileInput({
        ...baseProfile,
        testDate: "2026-08-10",
      }),
    ).toMatchObject({ testDate: "2026-08-10" });
  });

  it("rejects past test dates", () => {
    expect(() =>
      parseStudyPlanProfileInput({
        ...baseProfile,
        testDate: "2026-08-09",
      }),
    ).toThrow("Test date must be today or in the future.");
  });

  it("rejects test dates outside the selected year", () => {
    expect(() =>
      parseStudyPlanProfileInput({
        ...baseProfile,
        testDate: "2027-09-15",
      }),
    ).toThrow("Test date must be in the selected test year.");
  });
});

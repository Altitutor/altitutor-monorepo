import {
  buildStudyPlanCalendarMonths,
  daysBetweenDateKeys,
  studyPlanCalendarIntensityLevel,
} from "@/features/study-plan/lib/calendar";

describe("Study plan calendar", () => {
  it("builds stable six-week month grids with Monday first", () => {
    const [july] = buildStudyPlanCalendarMonths("2026-07-15", "2026-07-31");

    expect(july.key).toBe("2026-07");
    expect(july.days).toHaveLength(42);
    expect(july.days[2]?.dateKey).toBe("2026-07-01");
    expect(july.days[32]?.dateKey).toBe("2026-07-31");
  });

  it("builds every month in an inclusive range", () => {
    expect(
      buildStudyPlanCalendarMonths("2026-07-15", "2026-09-01").map(
        (month) => month.key,
      ),
    ).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("calculates date countdowns without daylight-saving drift", () => {
    expect(daysBetweenDateKeys("2026-09-30", "2026-10-04")).toBe(4);
  });

  it("uses the stronger of scheduled load and recorded activity", () => {
    expect(studyPlanCalendarIntensityLevel(0, 0)).toBe(0);
    expect(studyPlanCalendarIntensityLevel(30, 0)).toBe(1);
    expect(studyPlanCalendarIntensityLevel(90, 0)).toBe(3);
    expect(studyPlanCalendarIntensityLevel(0, 12)).toBe(4);
  });
});

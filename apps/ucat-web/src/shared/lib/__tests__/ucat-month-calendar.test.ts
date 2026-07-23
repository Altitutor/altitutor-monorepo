import {
  activityIntensityLevel,
  relativeActivityIntensityLevel,
  buildUcatCalendarMonths,
  localDateKey,
} from "../ucat-month-calendar";

describe("activity intensity", () => {
  it("buckets totals", () => {
    expect(activityIntensityLevel(0)).toBe(0);
    expect(activityIntensityLevel(1)).toBe(1);
    expect(activityIntensityLevel(2)).toBe(1);
    expect(activityIntensityLevel(3)).toBe(2);
    expect(activityIntensityLevel(5)).toBe(2);
    expect(activityIntensityLevel(6)).toBe(3);
    expect(activityIntensityLevel(9)).toBe(3);
    expect(activityIntensityLevel(10)).toBe(4);
  });

  it("scales against the busiest day in the month", () => {
    expect(relativeActivityIntensityLevel(0, 20)).toBe(0);
    expect(relativeActivityIntensityLevel(4, 20)).toBe(1);
    expect(relativeActivityIntensityLevel(8, 20)).toBe(2);
    expect(relativeActivityIntensityLevel(12, 20)).toBe(3);
    expect(relativeActivityIntensityLevel(20, 20)).toBe(4);
    expect(relativeActivityIntensityLevel(1, 1)).toBe(4);
  });
});

describe("ucat month calendar builders", () => {
  it("builds stable six-week month grids with Monday first", () => {
    const [july] = buildUcatCalendarMonths("2026-07-15", "2026-07-31");

    expect(july.key).toBe("2026-07");
    expect(july.days).toHaveLength(42);
    expect(july.days[2]?.dateKey).toBe("2026-07-01");
    expect(july.days[32]?.dateKey).toBe("2026-07-31");
  });

  it("formats local date keys", () => {
    expect(localDateKey(new Date(2025, 2, 17))).toBe("2025-03-17");
  });
});

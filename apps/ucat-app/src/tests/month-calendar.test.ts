import test from "node:test";
import assert from "node:assert/strict";
import {
  activityCalendarStartKey,
  buildActivityCalendarMonths,
  localDateKey,
  monthActivityMaxima,
  relativeActivityIntensityLevel,
} from "../features/progress/month-calendar";

test("practice calendar months are Monday-first six-week grids", () => {
  const [july] = buildActivityCalendarMonths("2026-07-15", "2026-07-31");
  assert.equal(july.key, "2026-07");
  assert.equal(july.days.length, 42);
  assert.equal(july.days[2]?.dateKey, "2026-07-01");
  assert.equal(july.days[32]?.dateKey, "2026-07-31");
});

test("practice calendar includes every month from first activity through today", () => {
  const months = buildActivityCalendarMonths("2025-12-20", "2026-02-03");
  assert.deepEqual(
    months.map((month) => month.key),
    ["2025-12", "2026-01", "2026-02"],
  );
});

test("practice intensity scales against the busiest day in the same month", () => {
  assert.equal(relativeActivityIntensityLevel(0, 20), 0);
  assert.equal(relativeActivityIntensityLevel(4, 20), 1);
  assert.equal(relativeActivityIntensityLevel(8, 20), 2);
  assert.equal(relativeActivityIntensityLevel(12, 20), 3);
  assert.equal(relativeActivityIntensityLevel(20, 20), 4);
  assert.equal(relativeActivityIntensityLevel(1, 1), 4);
});

test("calendar range starts at the earliest activity or account start", () => {
  assert.equal(
    activityCalendarStartKey(
      ["2026-03-02", "2026-01-20"],
      "2026-02-01T10:00:00.000Z",
      "2026-03-10",
    ),
    "2026-01-20",
  );
  assert.equal(activityCalendarStartKey([], null, "2026-09-21"), "2026-09-21");
  assert.equal(localDateKey(new Date(2025, 2, 17)), "2025-03-17");
  assert.equal(
    monthActivityMaxima([
      { dateKey: "2026-07-01", questionAttempts: 2, setAttempts: 1 },
      { dateKey: "2026-07-08", questionAttempts: 10, setAttempts: 0 },
      { dateKey: "2026-08-01", questionAttempts: 4, setAttempts: 4 },
    ]).get("2026-07"),
    10,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  displayChartDate,
  indexNearestToday,
  practiceWeeks,
} from "../features/progress/chart-dates";
test("chart labels use day and month, and opening position selects today ahead of forecasts", () => {
  assert.equal(displayChartDate("2026-11-09"), "9 Nov");
  assert.equal(
    indexNearestToday(["2026-09-01", "2026-09-19", "2026-10-01"], "2026-09-19"),
    1,
  );
  assert.equal(
    indexNearestToday(["2026-09-01", "2026-09-18", "2026-10-01"], "2026-09-19"),
    1,
  );
});
test("swipeable streak weeks preserve year boundaries, today, future days and recorded practice", () => {
  const weeks = practiceWeeks(
    [{ dateKey: "2025-12-31", questionAttempts: 3 }],
    "2026-01-02",
  );
  assert.equal(weeks.length, 4);
  const latest = weeks.at(-1)!;
  assert.equal(latest[0].key, "2025-12-28");
  assert.equal(latest[6].key, "2026-01-03");
  assert.equal(latest.find((d) => d.today)?.key, "2026-01-02");
  assert.equal(latest[6].future, true);
  assert.equal(latest.find((d) => d.key === "2025-12-31")?.count, 3);
});

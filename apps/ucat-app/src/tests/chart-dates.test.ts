import test from "node:test";
import assert from "node:assert/strict";
import { displayChartDate, indexNearestToday } from "../features/progress/chart-dates";
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

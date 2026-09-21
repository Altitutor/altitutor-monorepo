import test from "node:test";
import assert from "node:assert/strict";
import {
  CELL_GAP,
  hitDay,
  type CalendarGrid,
} from "../features/progress/calendar-hit";

const days = Array.from({ length: 42 }, (_, index) =>
  index === 8
    ? { dateKey: "2026-09-02", dayNumber: 2 }
    : index === 9
      ? { dateKey: "2026-09-03", dayNumber: 3 }
      : index === 10
        ? { dateKey: "2026-09-22", dayNumber: 22 }
        : null,
);

const grid: CalendarGrid = {
  x: 20,
  y: 80,
  cell: 40,
  days,
};

test("hitDay maps a tap onto the matching calendar cell", () => {
  const hit = hitDay(
    grid,
    20 + 40 + CELL_GAP + 5,
    80 + 40 + CELL_GAP + 5,
    "2026-09-21",
  );
  assert.equal(hit?.day.dateKey, "2026-09-02");
  assert.equal(hit?.index, 8);
});

test("hitDay switches to a neighbouring day instead of missing", () => {
  const hit = hitDay(
    grid,
    20 + (40 + CELL_GAP) * 2 + 5,
    80 + 40 + CELL_GAP + 5,
    "2026-09-21",
  );
  assert.equal(hit?.day.dateKey, "2026-09-03");
});

test("hitDay ignores gutter taps, blanks, and future days", () => {
  assert.equal(
    hitDay(grid, 20 + 40 + 1, 80 + 40 + CELL_GAP + 5, "2026-09-21"),
    null,
  );
  assert.equal(hitDay(grid, 22, 82, "2026-09-21"), null);
  assert.equal(
    hitDay(
      grid,
      20 + (40 + CELL_GAP) * 3 + 5,
      80 + 40 + CELL_GAP + 5,
      "2026-09-21",
    ),
    null,
  );
});

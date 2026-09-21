import test from "node:test";
import assert from "node:assert/strict";
import {
  gapDetail,
  hitRect,
  scalePercent,
  scorePillsOverlap,
} from "../features/progress/score-scale";

test("section scores map onto the 300–900 scale", () => {
  assert.equal(scalePercent(300, 300, 900), 0);
  assert.equal(scalePercent(600, 300, 900), 50);
  assert.equal(scalePercent(900, 300, 900), 100);
  assert.equal(scalePercent(2700, 900, 2700), 100);
});

test("nearby estimate and target pills stack instead of overlapping", () => {
  assert.equal(scorePillsOverlap(40, 50), true);
  assert.equal(scorePillsOverlap(20, 50), false);
  assert.equal(scorePillsOverlap(null, 50), false);
});

test("gap copy names how far the estimate sits from target", () => {
  assert.equal(gapDetail(640, 700), "60 points to target");
  assert.equal(gapDetail(720, 700), "20 points ahead of target");
  assert.equal(gapDetail(700, null), null);
});

test("hitRect picks the pill under a tap", () => {
  const estimate = { id: "e", x: 40, y: 80, width: 36, height: 20 };
  const target = { id: "t", x: 120, y: 80, width: 36, height: 20 };
  assert.equal(hitRect([estimate, target], 50, 90)?.id, "e");
  assert.equal(hitRect([estimate, target], 130, 88)?.id, "t");
  assert.equal(hitRect([estimate, target], 10, 10), null);
});

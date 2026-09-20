import assert from "node:assert/strict";
import test from "node:test";
import { practiceSecondsPerQuestion } from "../features/practice/pace";
test("pace applies database exam timing: double speed halves session time", () => {
  const rate = practiceSecondsPerQuestion(30, 2, true);
  assert.equal(rate, 15);
  assert.equal((rate ?? 0) * 12, 180);
  assert.equal(practiceSecondsPerQuestion(30, 0.5, true), 60);
  assert.equal(practiceSecondsPerQuestion(30, 1, true), 30);
});
test("untimed practice remains untimed and missing timing cannot silently create untimed practice", () => {
  assert.equal(practiceSecondsPerQuestion(null, 1, false), null);
  assert.throws(() => practiceSecondsPerQuestion(null, 1, true));
  assert.throws(() => practiceSecondsPerQuestion(30, 0, true));
});

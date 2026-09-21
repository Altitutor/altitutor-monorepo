import { test } from "node:test";
import assert from "node:assert/strict";
import { applyNumpadKey } from "../features/skill-trainer/lib/numpad-input";

test("ON/C clears the numpad sequence", () => {
  assert.deepEqual(applyNumpadKey(["1", "2", "+", "3"], "ON/C"), []);
});

test("ordinary calculator keys append to the numpad sequence", () => {
  assert.deepEqual(applyNumpadKey(["1"], "2"), ["1", "2"]);
});

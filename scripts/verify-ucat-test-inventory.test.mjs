import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSameInventory,
  verifyInventory,
} from "./verify-ucat-test-inventory.mjs";

test("coverage must include exactly the original discovered test inventory", () => {
  assert.equal(assertSameInventory(["b", "a"], ["a", "b"]), 2);
  assert.throws(
    () => assertSameInventory(["a", "b"], ["a"]),
    /inventories differ/u,
  );
  assert.throws(() => assertSameInventory([], []), /nonempty/u);
});

test("discovery invokes the actual unit and coverage scripts without running tests", () => {
  const calls = [];
  assert.equal(
    verifyInventory((command, args) => {
      calls.push({ command, args });
      return { status: 0, stdout: '["test-a"]' };
    }),
    1,
  );
  assert.equal(calls[0].args[3], "test");
  assert.equal(calls[1].args[3], "test:coverage");
  for (const call of calls) assert.ok(call.args.includes("--listTests"));
});

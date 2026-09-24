import assert from "node:assert/strict";
import test from "node:test";

import { startLocalSupabase } from "./start-local-supabase.mjs";

test("retries transient startup failures and cleans up partial state", async () => {
  const exitCodes = [1, 1, 0];
  const starts = [];
  const cleanups = [];
  const delays = [];

  await startLocalSupabase({
    args: ["--exclude", "studio"],
    delayMs: 25,
    runStart: async (args) => {
      starts.push(args);
      return exitCodes.shift();
    },
    cleanup: async () => cleanups.push("cleanup"),
    wait: async (delayMs) => delays.push(delayMs),
    log: () => {},
  });

  assert.deepEqual(starts, [
    ["--exclude", "studio"],
    ["--exclude", "studio"],
    ["--exclude", "studio"],
  ]);
  assert.equal(cleanups.length, 2);
  assert.deepEqual(delays, [25, 25]);
});

test("fails after the configured startup attempts", async () => {
  let starts = 0;
  let cleanups = 0;

  await assert.rejects(
    startLocalSupabase({
      attempts: 2,
      delayMs: 0,
      runStart: async () => {
        starts += 1;
        return 1;
      },
      cleanup: async () => {
        cleanups += 1;
      },
      wait: async () => {},
      log: () => {},
    }),
    /failed after 2 attempts/,
  );

  assert.equal(starts, 2);
  assert.equal(cleanups, 1);
});

test("does not clean up or wait after a successful first start", async () => {
  let cleanups = 0;
  let waits = 0;

  await startLocalSupabase({
    runStart: async () => 0,
    cleanup: async () => {
      cleanups += 1;
    },
    wait: async () => {
      waits += 1;
    },
    log: () => {},
  });

  assert.equal(cleanups, 0);
  assert.equal(waits, 0);
});

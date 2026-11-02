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

// Exercise the actual entrypoint with the external CLI boundary isolated.
test("local startup cannot bypass disposable database ownership", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtemp, writeFile, chmod, rm, access } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "startup-ownership-"));
  const marker = join(directory, "cli-called");
  const executable = join(directory, "supabase");
  await writeFile(executable, '#!/bin/sh\nprintf touched > "' + marker + '"\nexit 1\n');
  await chmod(executable, 0o700);
  try {
    const result = spawnSync(process.execPath, [
      new URL("./start-local-supabase.mjs", import.meta.url).pathname,
    ], {
      env: { ...process.env, PATH: directory, GITHUB_ACTIONS: "false", RUNNER_ENVIRONMENT: "local" },
      encoding: "utf8",
      timeout: 2000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /owned disposable database/u);
    await assert.rejects(access(marker), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

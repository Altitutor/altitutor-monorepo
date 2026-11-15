import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

function harness(t, profile, extra = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "checkall-profiles-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "bin"));
  for (const file of ["checkall.sh", "validation-receipt.mjs"])
    copyFileSync(
      new URL(file, import.meta.url),
      path.join(root, "scripts", file),
    );
  writeFileSync(
    path.join(root, "scripts/validation-preflight.mjs"),
    "process.exitCode=Number(process.env.PREFLIGHT_FAIL||0);",
  );
  writeFileSync(path.join(root, "scripts/verify-ucat-test-inventory.mjs"), "");
  const script = (name, body) =>
    writeFileSync(
      path.join(root, "bin", name),
      `#!/usr/bin/env bash\nset -eu\n${body}\n`,
      { mode: 0o755 },
    );
  script(
    "node",
    `if [ "\${1:-}" = --test ]; then exit 0; fi\nexec '${process.execPath}' "$@"`,
  );
  script("git", `if [ "$1" != status ]; then printf '%040d\\n' 1; fi`);
  for (const name of ["pnpm", "deno", "supabase"])
    script(
      name,
      `echo '${name}' "$@" >> "$COMMAND_LOG"\nif [ "\${FAIL_COMMAND:-}" = "${name} $*" ]; then exit 7; fi`,
    );
  script(
    "python3",
    `echo python3 "$@" >> "$COMMAND_LOG"
if [ "\${2:-}" = run ]; then
  shift 3
  ALTITUTOR_OWNED_DB_INNER=1 "$@"
  exit "\${CLEANUP_FAIL:-0}"
elif [ "\${2:-}" = gate ]; then
  ALTITUTOR_OWNED_DB_INNER=1 bash scripts/checkall.sh --database-only
  exit "\${CLEANUP_FAIL:-0}"
fi`,
  );
  mkdirSync(path.join(root, "supabase/scripts"), { recursive: true });
  writeFileSync(
    path.join(root, "supabase/scripts/apply-ucat-test-seed.sh"),
    "exit 0\n",
  );
  const receipt = path.join(root, "receipt.json");
  const log = path.join(root, "commands.log");
  writeFileSync(log, "");
  const args =
    profile === "database" ? ["--database-only"] : ["--profile", profile];
  const result = spawnSync(
    "bash",
    [path.join(root, "scripts/checkall.sh"), ...args],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
        ALTITUTOR_OWNED_DB_INNER: "",
        ALTITUTOR_VALIDATION_RECEIPT: receipt,
        ALTITUTOR_VALIDATION_REVISION: "2",
        COMMAND_LOG: log,
        UCAT_E2E_BASE_URL: "http://localhost:9999",
        ...extra,
      },
    },
  );
  return {
    result,
    receipt: JSON.parse(readFileSync(receipt, "utf8")),
    commands: readFileSync(log, "utf8"),
  };
}

test("preflight failure prevents every expensive stage and records remaining stages not run", (t) => {
  const { result, receipt, commands } = harness(t, "full", {
    PREFLIGHT_FAIL: "1",
  });
  assert.equal(result.status, 1);
  assert.equal(commands, "");
  assert.equal(receipt.status, "failed");
  assert.equal(receipt.stages[0].status, "failed");
  assert.ok(
    receipt.stages.slice(1).every((stage) => stage.status === "not-run"),
  );
});

test("check profile preserves ordinary unit tests and makes no full-gate claim", (t) => {
  const { result, receipt, commands } = harness(t, "check");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.profile, "check");
  assert.deepEqual(commands.trim().split("\n"), [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
  ]);
});

test("full profile runs UCAT only with coverage and retains unique database suites through cleanup", (t) => {
  const { result, receipt, commands } = harness(t, "full");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(receipt.status, "complete");
  assert.match(commands, /pnpm test --filter=!ucat-web/u);
  assert.match(commands, /pnpm --filter ucat-web test:coverage/u);
  for (const file of [
    "test-interview-station-upgrade.py",
    "test-interview-concurrency.py",
  ])
    assert.ok(commands.includes(file));
  assert.match(commands, /generation-replacement\.integration\.ts/u);
  assert.equal(receipt.stages.at(-1).name, "owned-cleanup");
  assert.ok(receipt.stages.every((stage) => stage.status === "passed"));
});

test("failed owned cleanup fails the full receipt rather than certifying the completed browser stage", (t) => {
  const { result, receipt } = harness(t, "full", { CLEANUP_FAIL: "9" });
  assert.notEqual(result.status, 0);
  assert.equal(receipt.status, "failed");
  assert.equal(receipt.stages.at(-1).name, "owned-cleanup");
  assert.equal(receipt.stages.at(-1).status, "failed");
});

test("database subset has a separate complete receipt without pretending to run lint or build", (t) => {
  const { result, receipt, commands } = harness(t, "database");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(receipt.profile, "database");
  assert.equal(receipt.status, "complete");
  assert.doesNotMatch(commands, /pnpm lint|pnpm build/u);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findProductionWebBaseline, loadProductionWebBaseline, planProductionWebRelease } from "./production-web-selection.mjs";

const repository = "Altitutor/altitutor-monorepo";
const previous = "a".repeat(40);
const current = "b".repeat(40);
const work = {
  event: "push",
  baseline: previous,
  head: current,
  changedFiles: () => ["apps/tutor-web/src/app/page.tsx"],
};
const apps = (plan) => plan.deployments.map(({ app }) => app);
const all = ["admin-web", "marketing-web", "student-web", "tutor-web", "ucat-web"];

test("selects just the changed web app", () => {
  assert.deepEqual(apps(planProductionWebRelease(work)), ["tutor-web"]);
});

test("selects no web build for independent native changes", () => {
  assert.deepEqual(apps(planProductionWebRelease({
    ...work,
    changedFiles: () => [
      "apps/tutor-app/src/components/header-actions.tsx",
      "apps/teaching-ipad/Teaching/ContentView.swift",
    ],
  })), []);
});

test("selects all apps for shared, database, release tooling or unknown inputs", () => {
  for (const file of [
    "packages/ui/src/button.tsx",
    "supabase/migrations/001_change.sql",
    ".github/workflows/supabase-deploy.yml",
    "scripts/sync-email-assets.mjs",
    "pnpm-lock.yaml",
    "unknown-build-input.txt",
  ]) {
    assert.deepEqual(apps(planProductionWebRelease({
      ...work,
      changedFiles: () => ["apps/tutor-web/src/app/page.tsx", file],
    })), all, file);
  }
});

test("retains full dispatch and falls back to all apps for unknown or divergent ancestry", () => {
  assert.deepEqual(apps(planProductionWebRelease({ ...work, event: "workflow_dispatch" })), all);
  assert.deepEqual(apps(planProductionWebRelease({ ...work, baseline: null })), all);
  assert.deepEqual(apps(planProductionWebRelease({
    ...work,
    changedFiles: () => { throw new Error("base is not an ancestor"); },
  })), all);
});

test("selects both sides of a rename and all deleted web paths", (context) => {
  const cwd = mkdtempSync(join(tmpdir(), "production-web-selection-"));
  context.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init");
  for (const app of ["tutor-web", "student-web", "admin-web"]) {
    mkdirSync(join(cwd, "apps", app), { recursive: true });
  }
  writeFileSync(join(cwd, "apps/tutor-web/file.ts"), "export const value = 1;\n");
  writeFileSync(join(cwd, "apps/admin-web/file.ts"), "export const value = 2;\n");
  const commit = (message) => {
    git("add", "-A");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.com",
      "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const baseline = commit("Before");
  renameSync(join(cwd, "apps/tutor-web/file.ts"), join(cwd, "apps/student-web/file.ts"));
  rmSync(join(cwd, "apps/admin-web/file.ts"));
  const head = commit("After");

  assert.deepEqual(apps(planProductionWebRelease({ event: "push", baseline, head, cwd })),
    ["admin-web", "student-web", "tutor-web"]);
  assert.deepEqual(apps(planProductionWebRelease({ event: "push", baseline: head, head: baseline, cwd })), all);
});

function run(id, head_sha, overrides = {}) {
  return {
    id,
    head_sha,
    run_attempt: 1,
    updated_at: new Date(id * 1000).toISOString(),
    status: "completed",
    conclusion: "failure",
    event: "push",
    head_branch: "main",
    path: ".github/workflows/supabase-deploy.yml",
    repository: { full_name: repository },
    head_repository: { full_name: repository },
    ...overrides,
  };
}

const successfulWeb = [
  { name: "deploy", status: "completed", conclusion: "success" },
  { name: "Smoke production web apps", status: "completed", conclusion: "success" },
  { name: "Deliver student-app ios production", status: "completed", conclusion: "failure" },
];

test("uses successful web smoke on the exact workflow attempt despite a later native failure", () => {
  const baseline = findProductionWebBaseline({
    repository,
    currentRunId: 100,
    runs: [run(100, current), run(99, previous, { run_attempt: 2 })],
    jobsForAttempt: (runId, attempt) => {
      assert.equal(runId, 99);
      assert.equal(attempt, 2);
      return successfulWeb;
    },
  });
  assert.equal(baseline, previous);
});

test("skips untrusted or unsuccessful web runs and carries their pending changes forward", () => {
  const baseline = findProductionWebBaseline({
    repository,
    currentRunId: 100,
    runs: [
      run(99, "d".repeat(40), { head_repository: { full_name: "fork/monorepo" } }),
      run(98, "c".repeat(40), { conclusion: "cancelled" }),
      run(97, "e".repeat(40)),
      run(96, previous),
    ],
    jobsForAttempt: (id) => {
      assert.ok([98, 97, 96].includes(id));
      return id === 96 ? successfulWeb : [];
    },
  });
  const plan = planProductionWebRelease({
    ...work,
    baseline,
    changedFiles: (base, head) => {
      assert.equal(base, previous);
      assert.equal(head, current);
      return ["apps/student-web/file.ts", "apps/tutor-app/App.tsx"];
    },
  });
  assert.deepEqual(apps(plan), ["student-web"]);
});

test("forces all apps after an uncertain partial deployment even if the next commit reverts its changes", () => {
  const baseline = findProductionWebBaseline({
    repository,
    currentRunId: 100,
    runs: [run(99, current, { conclusion: "cancelled" }), run(98, previous)],
    jobsForAttempt: (id) => id === 99 ? [successfulWeb[0]] : successfulWeb,
  });
  assert.equal(baseline, null);
  assert.deepEqual(apps(planProductionWebRelease({ ...work, baseline })), all);
});

test("recognizes older commits rerun after a newer completed release", () => {
  const baseline = findProductionWebBaseline({
    repository,
    currentRunId: 100,
    runs: [
      run(99, current),
      run(98, previous, { run_attempt: 2, updated_at: new Date(99_500).toISOString() }),
    ],
    jobsForAttempt: (id) => {
      assert.equal(id, 98);
      return successfulWeb;
    },
  });
  assert.equal(baseline, previous);
});

test("forces all apps on a full retry or when a newer partial retry has incomplete evidence", () => {
  assert.deepEqual(apps(planProductionWebRelease({ ...work, rerun: true })), all);
  assert.equal(findProductionWebBaseline({
    repository,
    currentRunId: 100,
    runs: [run(99, current, { run_attempt: 2 }), run(98, previous)],
    jobsForAttempt: (id) => id === 99 ? [] : successfulWeb,
  }), null);
});

test("includes a pending retry whose previous attempt could have partially deployed", () => {
  const baseline = loadProductionWebBaseline({
    repository,
    currentRunId: 100,
    readJson: (path) => {
      const request = new URL(path, "https://api.github.com");
      assert.equal(request.pathname, `/repos/${repository}/actions/workflows/supabase-deploy.yml/runs`);
      assert.equal(request.searchParams.get("branch"), "main");
      assert.equal(request.searchParams.has("status"), false);
      return {
        total_count: 3,
        workflow_runs: [
          run(100, current, { status: "in_progress" }),
          run(99, current, { run_attempt: 2, status: "pending" }),
          run(98, previous),
        ],
      };
    },
  });
  assert.equal(baseline, null);
  assert.deepEqual(apps(planProductionWebRelease({ ...work, baseline })), all);
});

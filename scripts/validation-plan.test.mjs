import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createValidationPlan, eventRange, gitChangedFiles, githubOutputs, checkedOutIdentity } from "./validation-plan.mjs";

const base = "a".repeat(40), head = "b".repeat(40);
const event = { pull_request: { base: { sha: base }, head: { sha: head } } };
const planFor = (files) => createValidationPlan({ eventName: "pull_request", event, changedFiles: () => files });

test("uses event base and head for the complete PR, merge group and push", () => {
  assert.deepEqual(eventRange("pull_request", event), { base, head });
  assert.deepEqual(eventRange("merge_group", { merge_group: { base_sha: base, head_sha: head } }), { base, head });
  assert.deepEqual(eventRange("push", { before: base, after: head }), { base, head });
  const plan = createValidationPlan({ eventName: "merge_group", event: { merge_group: { base_sha: base, head_sha: head } }, changedFiles: (actualBase, actualHead) => {
    assert.equal(actualBase, base); assert.equal(actualHead, head);
    return ["apps/student-web/src/page.tsx", "apps/tutor-web/src/page.tsx"];
  } });
  assert.deepEqual(plan.apps, ["student", "tutor"]);
  assert.equal(plan.turbo_filter, `...[${base}...${head}]`);
});

test("missing, zero, empty, unreadable and manual ranges select full validation", () => {
  const inputs = [
    { eventName: "workflow_dispatch", event },
    { eventName: "pull_request", event: null },
    { eventName: "push", event: { before: "0".repeat(40), after: head } },
    { eventName: "pull_request", event, changedFiles: () => [] },
    { eventName: "pull_request", event, changedFiles: () => { throw new Error("missing object"); } },
    { eventName: "pull_request", event, all: true },
  ];
  for (const input of inputs) {
    const plan = createValidationPlan(input);
    assert.equal(plan.profile, "full"); assert.equal(plan.apps.length, 5);
    assert.equal(plan.database, true); assert.equal(plan.edge, true); assert.equal(plan.ucat_coverage, true);
    assert.equal(plan.turbo_filter, "");
  }
});

test("domain closure retains auth, database, shared and unknown coverage", () => {
  for (const file of ["apps/admin-web/src/features/auth/client.ts", "apps/tutor-web/src/middleware.ts", "supabase/migrations/new.sql", "supabase/functions/new/index.ts", "packages/shared/src/index.ts", "pnpm-lock.yaml", "new-runtime/config.json"]) {
    const plan = planFor([file]);
    assert.equal(plan.database, true, file); assert.equal(plan.edge, true, file); assert.equal(plan.ucat_coverage, true, file);
    for (const app of ["admin", "student", "tutor", "ucat"]) assert.ok(plan.apps.includes(app), file);
  }
  assert.equal(planFor(["packages/ui/src/button.tsx"]).ucat_coverage, true);
  assert.equal(planFor(["apps/ucat-web/src/page.tsx"]).ucat_coverage, true);
});

test("known isolated app, native and documentation scopes record explicit exclusions", () => {
  const plan = planFor(["apps/student-web/src/page.tsx"]);
  assert.deepEqual(plan.apps, ["student"]); assert.equal(plan.database, false);
  assert.equal(plan.edge, false); assert.equal(plan.ucat_coverage, false);
  assert.ok(plan.exclusions.some((item) => item.gate === "edge"));
  const docs = planFor(["docs/testing.md", "apps/ucat-app/src/learn.tsx"]);
  assert.equal(docs.run, false); assert.equal(docs.profile, "affected");
  const output = githubOutputs(plan);
  assert.match(output, /apps=\["student"\]/u); assert.match(output, /student=true/u);
  const native = planFor(["apps/teaching-ipad/project.yml"]);
  assert.equal(native.teaching_ipad, true); assert.equal(native.run, false);
  assert.equal(planFor(["supabase/migrations/change.sql"]).supabase_types, true);
});

test("actual Git seam includes earlier group commits and both renamed paths", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "validation-plan-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init"); git("config", "user.email", "test@example.invalid"); git("config", "user.name", "Test");
    mkdirSync(path.join(cwd, "supabase/migrations"), { recursive: true });
    writeFileSync(path.join(cwd, "supabase/migrations/original.sql"), "select 1;\n");
    git("add", "."); git("commit", "-m", "base"); const initial = git("rev-parse", "HEAD");
    writeFileSync(path.join(cwd, "first.txt"), "earlier group change\n"); git("add", "."); git("commit", "-m", "first");
    renameSync(path.join(cwd, "supabase/migrations/original.sql"), path.join(cwd, "renamed.sql"));
    git("add", "."); git("commit", "-m", "second");
    const files = gitChangedFiles(initial, git("rev-parse", "HEAD"), cwd);
    assert.deepEqual(files.sort(), ["first.txt", "renamed.sql", "supabase/migrations/original.sql"]);
    assert.equal(planFor(files).database, true);
    const groupHead = git("rev-parse", "HEAD");
    const group = createValidationPlan({ eventName: "merge_group", event: { merge_group: { base_sha: initial, head_sha: groupHead } }, changedFiles: (a, b) => gitChangedFiles(a, b, cwd), identity: () => checkedOutIdentity(cwd) });
    assert.ok(group.files.includes("first.txt"));
    assert.ok(group.files.includes("supabase/migrations/original.sql"));
    assert.equal(group.checkout.commit, groupHead);
    assert.equal(group.checkout.tree, git("rev-parse", "HEAD^{tree}"));
    // A newer base with independent changes must never make the triple-dot
    // Turbo scope silently omit those changes from the tested integration.
    git("checkout", "--detach", initial);
    writeFileSync(path.join(cwd, "upstream.txt"), "new base\n"); git("add", "."); git("commit", "-m", "upstream");
    const newBase = git("rev-parse", "HEAD");
    const divergent = createValidationPlan({ eventName: "pull_request", event: { pull_request: { base: { sha: newBase }, head: { sha: groupHead } } }, changedFiles: (a, b) => gitChangedFiles(a, b, cwd), identity: () => checkedOutIdentity(cwd) });
    assert.equal(divergent.profile, "full"); assert.equal(divergent.turbo_filter, "");
    assert.equal(divergent.reason, "unavailable-or-divergent-event-range");
    assert.equal(divergent.database, true); assert.equal(divergent.teaching_ipad, true); assert.equal(divergent.supabase_types, true);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

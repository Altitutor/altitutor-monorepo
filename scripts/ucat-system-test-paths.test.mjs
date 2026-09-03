import assert from "node:assert/strict";
import test from "node:test";
import { shouldRunUcatSystemTests } from "./ucat-system-test-paths.mjs";

test("UCAT system tests run when UCAT, packages, or Supabase change", () => {
  assert.equal(shouldRunUcatSystemTests(["apps/ucat-web/src/app/page.tsx"]), true);
  assert.equal(shouldRunUcatSystemTests(["packages/shared/src/index.ts"]), true);
  assert.equal(shouldRunUcatSystemTests(["supabase/migrations/20260101000000_example.sql"]), true);
  assert.equal(shouldRunUcatSystemTests(["supabase/tests/example_test.sql"]), true);
  assert.equal(shouldRunUcatSystemTests(["pnpm-lock.yaml"]), true);
  assert.equal(shouldRunUcatSystemTests([".github/workflows/ci.yml"]), true);
  assert.equal(shouldRunUcatSystemTests(["scripts/checkall.sh"]), true);
});

test("UCAT system tests skip unrelated app and docs changes", () => {
  assert.equal(shouldRunUcatSystemTests([]), false);
  assert.equal(
    shouldRunUcatSystemTests(["apps/tutor-web/src/app/page.tsx"]),
    false,
  );
  assert.equal(
    shouldRunUcatSystemTests(["apps/marketing-web/src/app/page.tsx"]),
    false,
  );
  assert.equal(
    shouldRunUcatSystemTests(["apps/admin-web/package.json"]),
    false,
  );
  assert.equal(shouldRunUcatSystemTests(["docs/ucat-production-testing.md"]), false);
  assert.equal(
    shouldRunUcatSystemTests([".github/workflows/supabase-deploy.yml"]),
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { decideWebSystemTests } from "./web-system-test-paths.mjs";

test("an app change selects only that app's browser suite", () => {
  assert.deepEqual(
    decideWebSystemTests(["apps/student-web/src/app/(student)/classes/page.tsx"]),
    {
      run: true,
      database: false,
      apps: {
        admin: false,
        marketing: false,
        student: true,
        tutor: false,
        ucat: false,
      },
    },
  );
});

test("Supabase changes select every data-backed web app and database contracts", () => {
  assert.deepEqual(
    decideWebSystemTests([
      "supabase/migrations/20260902000000_example.sql",
    ]),
    {
      run: true,
      database: true,
      apps: {
        admin: true,
        marketing: false,
        student: true,
        tutor: true,
        ucat: true,
      },
    },
  );
});

test("shared runtime changes select every web app", () => {
  const decision = decideWebSystemTests(["packages/ui/src/button.tsx"]);

  assert.equal(decision.run, true);
  assert.deepEqual(decision.apps, {
    admin: true,
    marketing: true,
    student: true,
    tutor: true,
    ucat: true,
  });
});

test("docs and native-only changes do not start web system tests", () => {
  assert.deepEqual(
    decideWebSystemTests([
      "docs/testing.md",
      "apps/student-app/src/app/index.tsx",
    ]),
    {
      run: false,
      database: false,
      apps: {
        admin: false,
        marketing: false,
        student: false,
        tutor: false,
        ucat: false,
      },
    },
  );
});

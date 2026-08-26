import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const APPS = [
  "admin-web",
  "marketing-web",
  "student-web",
  "tutor-web",
  "ucat-web",
];

const workflowPath = new URL(
  "../.github/workflows/supabase-deploy.yml",
  import.meta.url,
);
const ciWorkflowPath = new URL("../.github/workflows/ci.yml", import.meta.url);
const turboConfigPath = new URL("../turbo.json", import.meta.url);

test("Vercel Git integration cannot bypass the production release gate", async () => {
  await Promise.all(
    APPS.map(async (app) => {
      const configPath = new URL(`../apps/${app}/vercel.json`, import.meta.url);
      const config = JSON.parse(await readFile(configPath, "utf8"));

      assert.equal(
        config.git?.deploymentEnabled,
        false,
        `${app} must disable automatic Git deployments`,
      );
    }),
  );
});

test("every main push runs the migration gate before Vercel production deploys", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const trigger = workflow.slice(workflow.indexOf("on:"), workflow.indexOf("permissions:"));

  assert.match(trigger, /branches:\s*\[develop, main\]/u);
  assert.doesNotMatch(
    trigger,
    /^\s+paths:/mu,
    "path filtering could let an application-only release bypass the migration gate",
  );
  assert.match(workflow, /^  deploy-web:/mu);
  assert.match(workflow, /^  verify:/mu);
  assert.match(workflow, /^    uses: \.\/\.github\/workflows\/ci\.yml$/mu);
  assert.match(
    workflow,
    /^    with:\n      full_run: \$\{\{ github\.ref_name == 'main' \}\}$/mu,
  );
  assert.match(workflow, /^  deploy:\n    needs: verify$/mu);
  assert.match(workflow, /^    needs: deploy$/mu);
  assert.match(workflow, /^    environment: production$/mu);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);

  for (const app of APPS) {
    assert.match(workflow, new RegExp(`app: ${app}\\b`, "u"));
  }
});

test("release verification is parallel, branch-scoped, and independently cached", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");
  const buildJob = workflow.slice(workflow.indexOf("  build:"));
  const cacheKeys = workflow.match(
    /key: \$\{\{ runner\.os \}\}-turbo-\$\{\{ github\.job \}\}-\$\{\{ github\.sha \}\}/gu,
  );

  assert.match(workflow, /^  workflow_call:\n    inputs:\n      full_run:/mu);
  assert.match(
    workflow,
    /github\.event_name == 'push' && inputs\.full_run == false && '\.\.\.\[HEAD\^\]'/u,
  );
  assert.doesNotMatch(
    buildJob,
    /^    needs:/mu,
    "build should run in parallel with lint, typecheck, and test",
  );
  assert.equal(
    cacheKeys?.length,
    4,
    "each verification job should use its own immutable Turbo cache key",
  );

  const turboConfig = JSON.parse(await readFile(turboConfigPath, "utf8"));
  assert.equal(
    turboConfig.globalDependencies.includes(".github/workflows/ci.yml"),
    false,
    "CI orchestration changes must not invalidate application build outputs",
  );
});

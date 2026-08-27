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
const ucatPlaywrightConfigPath = new URL(
  "../apps/ucat-web/playwright.config.ts",
  import.meta.url,
);
const ucatJestConfigPath = new URL(
  "../apps/ucat-web/jest.config.js",
  import.meta.url,
);

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
  assert.match(workflow, /^  smoke-ucat-production:/mu);
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
  assert.match(workflow, /node scripts\/ucat-production-smoke\.mjs/u);

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

test("UCAT production verification executes every system test boundary", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");

  assert.match(
    workflow,
    /^  ucat-contracts:/mu,
    "CI must have a dedicated UCAT contract job",
  );
  assert.match(
    workflow,
    /pnpm --filter ucat-web test:coverage/u,
    "UCAT coverage must be release-gated",
  );
  assert.match(
    workflow,
    /deno test --allow-env supabase\/functions/u,
    "Supabase Edge Function contracts must be release-gated",
  );
  assert.match(
    workflow,
    /^  ucat-e2e:/mu,
    "CI must have a dedicated UCAT browser and database job",
  );
  assert.match(
    workflow,
    /supabase test db/u,
    "UCAT database contracts must be release-gated",
  );
  assert.match(
    workflow,
    /pnpm --filter ucat-web test:e2e/u,
    "UCAT browser journeys must be release-gated",
  );
  assert.match(
    workflow,
    /actions\/upload-artifact@v4/u,
    "Failed browser journeys must preserve diagnostic artifacts",
  );
});

test("UCAT browser verification exercises production mode and supported engines", async () => {
  const config = await readFile(ucatPlaywrightConfigPath, "utf8");

  assert.match(config, /pnpm exec next build/u);
  assert.match(config, /name: "desktop-chromium"/u);
  assert.match(config, /name: "desktop-chrome"/u);
  assert.match(config, /name: "desktop-edge"/u);
  assert.match(config, /name: "desktop-firefox"/u);
  assert.match(config, /name: "desktop-safari"/u);
  assert.match(config, /name: "mobile-android"/u);
  assert.match(config, /name: "mobile-ios"/u);
});

test("UCAT coverage includes unimported source and enforces a baseline", async () => {
  const config = await readFile(ucatJestConfigPath, "utf8");

  assert.match(config, /coverageProvider: "v8"/u);
  assert.match(config, /collectCoverageFrom:/u);
  assert.match(config, /coverageThreshold:/u);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditMigrationDirectory } from "./supabase-migration-privileges.mjs";

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
const typesCheckWorkflowPath = new URL(
  "../.github/workflows/supabase-types-check.yml",
  import.meta.url,
);
const turboConfigPath = new URL("../turbo.json", import.meta.url);
const checkallScriptPath = new URL("../scripts/checkall.sh", import.meta.url);
const supabaseConfigPath = new URL("../supabase/config.toml", import.meta.url);
const applyUcatSeedScriptPath = new URL(
  "../supabase/scripts/apply-ucat-test-seed.sh",
  import.meta.url,
);
const disableAutomaticSeedScriptPath = new URL(
  "../supabase/scripts/disable-automatic-seed.py",
  import.meta.url,
);
const ucatPlaywrightConfigPath = new URL(
  "../apps/ucat-web/playwright.config.ts",
  import.meta.url,
);
const ucatJestConfigPath = new URL(
  "../apps/ucat-web/jest.config.js",
  import.meta.url,
);
const uiTsconfigPath = new URL("../packages/ui/tsconfig.json", import.meta.url);
const emailDispatchSecretSyncPath = new URL(
  "../supabase/scripts/sync-ucat-email-dispatch-secret.sql",
  import.meta.url,
);

test("new Supabase API objects declare explicit privilege contracts", async () => {
  const violations = await auditMigrationDirectory(
    new URL("../supabase/migrations/", import.meta.url),
  );

  assert.deepEqual(violations, []);
});

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
  assert.match(workflow, /^  smoke-production:/mu);
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
  assert.match(workflow, /node scripts\/production-web-smoke\.mjs/u);

  for (const app of APPS) {
    assert.match(workflow, new RegExp(`app: ${app}\\b`, "u"));
  }
});

test("production deploys synchronize transactional email authentication", async () => {
  const [workflow, secretSync] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(emailDispatchSecretSyncPath, "utf8"),
  ]);

  assert.match(
    workflow,
    /UCAT_EMAIL_DISPATCH_SECRET_KEY: \$\{\{ secrets\.UCAT_EMAIL_DISPATCH_SECRET_KEY \}\}/u,
  );
  assert.match(workflow, /Require production transactional email authentication/u);
  assert.match(workflow, /supabase secrets set/u);
  assert.match(workflow, /sync-ucat-email-dispatch-secret\.sql/u);
  assert.match(secretSync, /vault\.update_secret/u);
  assert.match(secretSync, /vault\.create_secret/u);
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

test("production verification executes every system test boundary", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");
  const webE2eStart = workflow.indexOf("  web-e2e:");
  const webE2eJob = workflow.slice(
    webE2eStart,
    workflow.indexOf("\n  build:", webE2eStart),
  );

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
    /deno test --config supabase\/functions\/deno\.json --allow-env supabase\/functions/u,
    "Supabase Edge Function contracts must be release-gated",
  );
  assert.match(
    workflow,
    /^  web-e2e:/mu,
    "CI must have a dedicated web browser and database job",
  );
  assert.match(
    workflow,
    /supabase test db/u,
    "UCAT database contracts must be release-gated",
  );
  assert.match(
    workflow,
    /^  web-system-tests-needed:/mu,
    "browser and database tests must be skippable when the diff cannot affect them",
  );
  assert.match(
    webE2eJob,
    /^    needs: web-system-tests-needed$/mu,
  );
  assert.match(
    webE2eJob,
    /needs\.web-system-tests-needed\.outputs\.run == 'true'/u,
  );
  const renderTemplatesStep = webE2eJob.indexOf(
    "bash supabase/scripts/render-email-templates.sh",
  );
  const startSupabaseStep = webE2eJob.indexOf("supabase start");
  assert.ok(
    renderTemplatesStep >= 0 && renderTemplatesStep < startSupabaseStep,
    "UCAT verification must render gitignored Auth email templates before starting Supabase",
  );
  assert.doesNotMatch(
    webE2eJob,
    /supabase db reset/u,
    "A fresh supabase start already applies migrations and seed; db reset would redo that work",
  );
  assert.match(
    webE2eJob,
    /supabase start --exclude studio,imgproxy,logflare,vector,postgres-meta,mailpit/u,
  );
  const applyUcatSeedStep = webE2eJob.indexOf(
    "bash supabase/scripts/apply-ucat-test-seed.sh",
  );
  const databaseTestStep = webE2eJob.indexOf("supabase test db");
  assert.ok(
    applyUcatSeedStep >= 0 && applyUcatSeedStep < databaseTestStep,
    "UCAT study-plan fixtures must be applied after start and before database contracts",
  );
  assert.match(
    webE2eJob,
    /needs\.web-system-tests-needed\.outputs\.database == 'true' \|\| needs\.web-system-tests-needed\.outputs\.ucat == 'true'/u,
  );
  assert.match(webE2eJob, /Cache Supabase Docker images/u);
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
  const [config, uiTsconfigSource] = await Promise.all([
    readFile(ucatPlaywrightConfigPath, "utf8"),
    readFile(uiTsconfigPath, "utf8"),
  ]);
  const uiTsconfig = JSON.parse(uiTsconfigSource);

  const buildDependenciesStep = config.indexOf(
    "pnpm --workspace-root exec turbo run build --filter=ucat-web^...",
  );
  const buildApplicationStep = config.indexOf("pnpm exec next build");
  assert.ok(
    buildDependenciesStep >= 0 && buildDependenciesStep < buildApplicationStep,
    "Playwright must build UCAT workspace dependencies before Next.js on a clean checkout",
  );
  assert.equal(
    uiTsconfig.compilerOptions.noEmit,
    false,
    "@altitutor/ui must emit the dist files declared by its package exports",
  );
  assert.equal(uiTsconfig.compilerOptions.rootDir, "src");
  assert.match(config, /pnpm exec next build/u);
  assert.match(config, /name: "desktop-chromium"/u);
  assert.match(config, /name: "desktop-chrome"/u);
  assert.match(config, /name: "desktop-edge"/u);
  assert.match(config, /name: "desktop-firefox"/u);
  assert.match(config, /name: "desktop-safari"/u);
  assert.match(config, /name: "mobile-android"/u);
  assert.match(config, /name: "mobile-ios"/u);
  assert.match(config, /globalSetup: "\.\/e2e\/global-setup.ts"/u);
  const globalSetup = await readFile(
    new URL("../apps/ucat-web/e2e/global-setup.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    globalSetup,
    /if \(process\.env\.CI\) return/u,
    "CI applies UCAT fixtures before Playwright; local runs must seed themselves",
  );
});

test("UCAT coverage includes unimported source and enforces a baseline", async () => {
  const config = await readFile(ucatJestConfigPath, "utf8");

  assert.match(config, /coverageProvider: "v8"/u);
  assert.match(config, /collectCoverageFrom:/u);
  assert.match(config, /coverageThreshold:/u);
});

test("pnpm checkall runs the same system suites as CI", async () => {
  const [checkall, packageJsonSource] = await Promise.all([
    readFile(checkallScriptPath, "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);

  assert.equal(packageJson.scripts.checkall, "bash scripts/checkall.sh");
  assert.match(checkall, /pnpm turbo run lint/u);
  assert.match(checkall, /pnpm turbo run typecheck/u);
  assert.match(checkall, /pnpm turbo run test/u);
  assert.match(checkall, /pnpm turbo run build/u);
  assert.match(checkall, /pnpm --filter ucat-web test:coverage/u);
  assert.match(
    checkall,
    /deno test --config supabase\/functions\/deno\.json --allow-env supabase\/functions/u,
  );
  assert.match(checkall, /supabase test db/u);
  assert.match(checkall, /pnpm --filter ucat-web test:e2e:critical/u);
  assert.match(checkall, /supabase start/u);
  assert.match(
    checkall,
    /supabase status/u,
    "Local checkall must reset an already-running stack so schema matches CI",
  );
  assert.match(checkall, /supabase db reset/u);
  const applyUcatSeedStep = checkall.indexOf(
    "bash supabase/scripts/apply-ucat-test-seed.sh",
  );
  const databaseTestStep = checkall.indexOf("supabase test db");
  assert.ok(
    applyUcatSeedStep >= 0 && applyUcatSeedStep < databaseTestStep,
    "checkall must apply UCAT study-plan fixtures before database contracts",
  );
  assert.equal(
    packageJson.scripts["db:seed:ucat"],
    "bash supabase/scripts/apply-ucat-test-seed.sh",
  );
});

test("automatic seed excludes manual pastes and UCAT study-plan fixtures", async () => {
  const [config, applyScript, typesCheck] = await Promise.all([
    readFile(supabaseConfigPath, "utf8"),
    readFile(applyUcatSeedScriptPath, "utf8"),
    readFile(typesCheckWorkflowPath, "utf8"),
  ]);
  const [automaticSeedFiles, ucatSeedFiles, fixtures] = await Promise.all([
    readdir(new URL("../supabase/seed/test/", import.meta.url)),
    readdir(new URL("../supabase/seed/test-ucat/", import.meta.url)),
    readFile(
      new URL(
        "../supabase/seed/test-ucat/08_ucat_study_plan_fixtures.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(config, /sql_paths = \["\.\/seed\/test\/\*\.sql", "\.\/seed\/production\/\*\.sql"\]/u);
  assert.doesNotMatch(config, /seed\/\*\/\*\.sql/u);
  assert.doesNotMatch(config, /sql_paths = \[[^\]]*test-ucat/u);
  assert.equal(
    automaticSeedFiles.some((name) => name.includes("ucat_study_plan")),
    false,
  );
  assert.deepEqual(
    ucatSeedFiles.filter((name) => name.endsWith(".sql")).sort(),
    [
      "08_ucat_study_plan_fixtures.sql",
      "09_ucat_study_plan_personas.sql",
    ],
  );
  assert.match(fixtures, /DISABLE TRIGGER USER/u);
  assert.match(fixtures, /rebuild_ucat_duplicate_stem_pairs/u);
  assert.match(applyScript, /docker exec -i "\$db_container"/u);
  assert.match(applyScript, /psql -U postgres -d postgres -v ON_ERROR_STOP=1/u);
  assert.match(applyScript, /seed\/test-ucat/u);
  assert.doesNotMatch(applyScript, /--linked/u);
  assert.match(
    typesCheck,
    /python3 supabase\/scripts\/disable-automatic-seed.py/u,
  );
  assert.doesNotMatch(typesCheck, /apply-ucat-test-seed/u);

  const dryRun = spawnSync(
    "python3",
    [fileURLToPath(disableAutomaticSeedScriptPath), "--dry-run"],
    {
      encoding: "utf8",
      input: `[api]
enabled = true

[db.seed]
enabled = true

[realtime]
enabled = true
`,
    },
  );
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /\[db\.seed\]\nenabled = false/u);
  assert.match(dryRun.stdout, /\[api\]\nenabled = true/u);
  assert.match(dryRun.stdout, /\[realtime\]\nenabled = true/u);
});

test("every web app runs Playwright against a production build", async () => {
  const appConfigs = await Promise.all(
    APPS.map(async (app) => [
      app,
      await readFile(
        new URL(`../apps/${app}/playwright.config.ts`, import.meta.url),
        "utf8",
      ),
    ]),
  );

  for (const [app, config] of appConfigs) {
    assert.match(config, /pnpm exec next build/u, `${app} must build for E2E`);
    assert.match(config, /pnpm exec next start/u, `${app} must run production mode`);
    assert.match(
      config,
      /forbidOnly: Boolean\(process\.env\.CI\)/u,
      `${app} must reject focused tests in CI`,
    );
    assert.match(
      config,
      /failOnFlakyTests: process\.env\.CI_RELEASE_GATE === ["']true["']/u,
      `${app} must reject flaky retries on the release gate`,
    );
    assert.match(
      config,
      /video: "retain-on-failure"|video: 'retain-on-failure'/u,
      `${app} must retain failure video`,
    );
  }
});

test("data-backed portal E2E servers receive the local service-role key", async () => {
  for (const app of ["admin-web", "student-web", "tutor-web", "ucat-web"]) {
    const config = await readFile(
      new URL(`../apps/${app}/playwright.config.ts`, import.meta.url),
      "utf8",
    );
    assert.match(
      config,
      /SUPABASE_SERVICE_ROLE_KEY/u,
      `${app} server routes need a service-role key from the local test stack`,
    );
  }
});

test("admin E2E keeps role redirects inside the local test boundary", async () => {
  const config = await readFile(
    new URL("../apps/admin-web/playwright.config.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    config,
    /NEXT_PUBLIC_TUTOR_PORTAL_URL:\s*["']http:\/\/localhost:3002["']/u,
    "the production-mode admin build must not redirect seeded tutors to production",
  );
});

test("student E2E provides a test Stripe publishable key", async () => {
  const config = await readFile(
    new URL("../apps/student-web/playwright.config.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    config,
    /NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:\s*["']pk_test_[^"']+["']/u,
    "the production-mode student build must initialize Stripe with a test key",
  );
});

test("the main release gate runs every web app browser suite", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");

  assert.match(workflow, /^  web-system-tests-needed:/mu);
  assert.match(workflow, /node scripts\/web-system-test-paths\.mjs/u);
  assert.match(workflow, /pnpm --filter ucat-web test:e2e:desktop/u);
  for (const app of APPS.filter((app) => app !== "ucat-web")) {
    assert.match(
      workflow,
      new RegExp(`pnpm --filter ${app} test:e2e`, "u"),
      `${app} browser tests must be release-gated`,
    );
  }
});

test("UCAT treats retries as failures on the production gate", async () => {
  const config = await readFile(ucatPlaywrightConfigPath, "utf8");

  assert.match(config, /failOnFlakyTests: process\.env\.CI_RELEASE_GATE === "true"/u);
  assert.match(config, /forbidOnly: Boolean\(process\.env\.CI\)/u);
});

test("production deployment fails closed and smokes every web surface", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const deployFunctions = workflow.slice(
    workflow.indexOf("- name: Deploy edge functions"),
    workflow.indexOf("- name: Install jq"),
  );

  assert.doesNotMatch(
    deployFunctions,
    /\|\| true/u,
    "Edge Function deployment failures must block the release",
  );
  assert.match(workflow, /node scripts\/production-web-smoke\.mjs/u);
  for (const origin of [
    "https://admin.altitutor.com",
    "https://altitutor.com",
    "https://student.altitutor.com",
    "https://tutor.altitutor.com",
    "https://ucat.altitutor.com",
  ]) {
    assert.match(workflow, new RegExp(origin.replaceAll(".", "\\."), "u"));
  }
});

test("the native student app has an executable unit-test baseline", async () => {
  const packageJson = JSON.parse(
    await readFile(
      new URL("../apps/student-app/package.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(packageJson.scripts.test, "tsx --test src/**/*.test.ts");
  assert.equal(packageJson.devDependencies.tsx, "^4.20.6");
});

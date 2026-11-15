import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const ci = () => readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const suite = () => readFile(new URL('../.github/workflows/web-system-suite.yml', import.meta.url), 'utf8');

test('selected browser apps use bounded isolated runners and a stable fail-closed aggregate', async () => {
  const workflow = await ci();
  assert.match(workflow, /name: Detect web system tests/u);
  const lint = workflow.slice(workflow.indexOf('  lint:'), workflow.indexOf('  typecheck:'));
  assert.ok(lint.indexOf('pnpm install --frozen-lockfile') < lint.indexOf('node --test'), 'workflow contracts may import installed parsers');
  for (const contract of ['python3 scripts/owned_database.test.py', 'python3 scripts/worktree_dev.test.py', 'secrets/scripts/deploy-runtime.test.mjs']) {
    assert.ok(lint.includes(contract), `preserves the local safety contract ${contract}`);
  }
  const browser = workflow.slice(workflow.indexOf('  web-browser:'), workflow.indexOf('  database-contracts:'));
  assert.match(workflow, /^  merge_group:/mu);
  assert.match(browser, /max-parallel: 3/u);
  assert.match(browser, /fail-fast: false/u);
  assert.match(browser, /fromJSON\(needs\.validation-plan\.outputs\.apps/u);
  assert.match(browser, /uses: \.\/\.github\/workflows\/web-system-suite.yml/u);
  const aggregate = workflow.slice(workflow.indexOf('  web-e2e:'), workflow.indexOf('  build:'));
  assert.match(aggregate, /name: Web Browser and Database/u);
  assert.match(aggregate, /if: always\(\)/u);
  assert.match(aggregate, /needs: \[validation-plan, lint, typecheck, test, ucat-contracts, build, web-browser, database-contracts\]/u);
  assert.match(aggregate, /WEB_CI_NEEDS: \$\{\{ toJSON\(needs\) \}\}/u);
  assert.match(aggregate, /node scripts\/web-ci-result.mjs/u);
});

test('isolated suites retain real production builds, database gates, browser matrices and failure artifacts', async () => {
  const workflow = await suite();
  assert.match(workflow, /runs-on: ubuntu-24.04/u);
  assert.match(workflow, /node scripts\/start-local-supabase.mjs --exclude studio,imgproxy,logflare,vector,postgres-meta,mailpit/u);
  assert.doesNotMatch(workflow, /supabase db reset/u);
  assert.match(workflow, /supabase test db/u);
  for (const app of ['admin', 'marketing', 'student', 'tutor', 'ucat']) {
    assert.match(workflow, new RegExp(`pnpm --filter ${app}-web test:e2e`, 'u'));
  }
  for (const script of ['test-student-registration.py', 'test-imessage-inbound.py', 'test-interview-station-upgrade.py', 'test-interview-concurrency.py']) {
    assert.ok(workflow.includes(script), `preserves ${script}`);
  }
  assert.match(workflow, /generation-replacement.integration.ts/u);
  assert.match(workflow, /UCAT_E2E_FULL_BROWSER_MATRIX/u);
  assert.match(workflow, /STUDENT_E2E_FULL_BROWSER_MATRIX/u);
  assert.match(workflow, /MARKETING_E2E_FULL_BROWSER_MATRIX: ['"]true['"]/u);
  assert.match(workflow, /if: always\(\)/u);
  assert.match(workflow, /name: web-playwright-\$\{\{ inputs.suite \}\}/u);
  assert.match(workflow, /retention-days: 14/u);
});

test('UCAT coverage owns its unit execution and cache restore remains task-hashed', async () => {
  const workflow = await ci();
  assert.match(workflow, /pnpm turbo run test --concurrency=2 --filter='!ucat-web'/u);
  assert.equal((workflow.match(/pnpm --filter ucat-web test:coverage/gu) ?? []).length, 1);
  assert.match(workflow, /needs\.validation-plan\.outputs\.ucat_coverage == 'true'/u);
  assert.ok(workflow.indexOf('node scripts/verify-ucat-test-inventory.mjs') < workflow.indexOf('pnpm --filter ucat-web test:coverage'));
  const build = workflow.slice(workflow.indexOf('  build:'));
  assert.match(build, /restore-keys:/u);
  assert.doesNotMatch(await suite(), /download-artifact/u, 'browser builds must not adopt generic Next artifacts');
});


test('merge-group receipt publication completes inside the required final gate', async () => {
  const workflow = parse(await ci());
  assert.equal(workflow.jobs['integration-receipt'], undefined, 'optional receipt job races queue completion');
  const gate = workflow.jobs['web-e2e'];
  assert.equal(gate.name, 'Web Browser and Database');
  assert.equal(gate.if, 'always()');
  assert.deepEqual(gate.needs, ['validation-plan', 'lint', 'typecheck', 'test', 'ucat-contracts', 'build', 'web-browser', 'database-contracts']);
  assert.equal(gate.steps[0].with.ref, '${{ github.sha }}');
  assert.equal(gate.steps[0].with['fetch-depth'], 0);
  const verify = gate.steps.findIndex(step => step.run === 'node scripts/web-ci-result.mjs');
  const create = gate.steps.findIndex(step => step.run?.includes('verified-integration.mjs create'));
  const upload = gate.steps.findIndex(step => step.with?.name === 'ci-integration-receipt');
  assert.ok(verify >= 0 && create > verify && upload > create);
  assert.match(gate.steps[create].run, /CI_REQUIRED_RESULTS="\$\(node scripts\/web-ci-result.mjs --receipt-results\)"/u);
  assert.match(gate.steps[create].run, /\nexport CI_REQUIRED_RESULTS\n/u);
  assert.equal(gate.steps[create].env.WEB_CI_NEEDS, '${{ toJSON(needs) }}');
  for (const step of gate.steps.slice(verify + 1)) {
    assert.equal(step.if, "github.event_name == 'merge_group'");
    assert.notEqual(step['continue-on-error'], true);
  }
  assert.equal(gate.steps[upload].with['if-no-files-found'], 'error');
  assert.equal(gate.steps[upload].with.path, 'integration-receipt.json');
});

test('every selection run preserves its full validation plan for diagnosis', async () => {
  const plan = parse(await ci()).jobs['validation-plan'];
  const select = plan.steps.find(step => step.id === 'plan');
  assert.match(select.run, /node scripts\/validation-plan.mjs > validation-plan.json/u);
  const upload = plan.steps.find(step => step.with?.name === 'validation-plan');
  assert.ok(upload);
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.path, 'validation-plan.json');
  assert.equal(upload.with['if-no-files-found'], 'error');
});

test('CI sets typecheck concurrency once without appending to the package script', async () => {
  const steps = parse(await ci()).jobs.typecheck.steps;
  const typecheck = steps.find(step => step.name === 'Run type check');
  assert.ok(typecheck, 'typecheck execution step exists');
  assert.match(typecheck.run, /pnpm exec turbo run typecheck --concurrency=1 --filter=/u);
  assert.match(typecheck.run, /^\s+pnpm exec turbo run typecheck --concurrency=1$/mu);
  assert.doesNotMatch(typecheck.run, /pnpm typecheck/u);
});

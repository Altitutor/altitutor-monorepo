import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const coreJobs = ['lint', 'typecheck', 'test', 'ucat-contracts', 'build'];
const script = new URL('./web-ci-result.mjs', import.meta.url);
const needs = (apps = ['admin'], database = false) => ({
  'validation-plan': { result: 'success', outputs: { apps: JSON.stringify(apps), database: String(database), run: String(apps.length > 0 || database) } },
  ...Object.fromEntries(coreJobs.map(job => [job, { result: 'success' }])),
  'web-browser': { result: apps.length ? 'success' : 'skipped' },
  'database-contracts': { result: database ? 'success' : 'skipped' },
});
function run(value, args = []) {
  return spawnSync(process.execPath, [script.pathname, ...args], {
    encoding: 'utf8', env: { ...process.env, WEB_CI_NEEDS: JSON.stringify(value) },
  });
}

test('the required aggregate accepts completed selected suites and deliberate empty selection', () => {
  for (const value of [needs(['admin', 'student'], true), needs([], true), needs([])]) {
    assert.equal(run(value).status, 0);
  }
});

test('failed, cancelled, missing, or unexpectedly skipped selected work blocks the aggregate', () => {
  for (const job of ['validation-plan', ...coreJobs, 'web-browser', 'database-contracts']) {
    for (const result of ['failure', 'cancelled', 'skipped', 'unknown', undefined]) {
      const value = needs(['admin'], true);
      value[job].result = result;
      assert.notEqual(run(value).status, 0, `${job}: ${result}`);
    }
  }
});

test('malformed selection cannot turn missing checks into success', () => {
  for (const outputs of [ {}, { apps: '[]', database: 'false', run: 'true' },
    { apps: '["unrecognized"]', database: 'false', run: 'true' },
    { apps: '["admin","admin"]', database: 'false', run: 'true' },
    { apps: 'not-json', database: 'false', run: 'false' } ]) {
    const value = needs([]);
    value['validation-plan'].outputs = outputs;
    assert.notEqual(run(value).status, 0);
  }
});


test('receipt results are emitted only after every prerequisite passes', () => {
  const value = needs(['ucat'], true);
  const result = run(value, ['--receipt-results']);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { ...value, 'web-e2e': { result: 'success' } });
  for (const job of ['validation-plan', ...coreJobs, 'web-browser', 'database-contracts']) {
    for (const status of ['failure', 'cancelled', 'skipped', undefined]) {
      const invalid = needs(['ucat'], true);
      invalid[job].result = status;
      invalid['web-e2e'] = { result: 'success' };
      const rejected = run(invalid, ['--receipt-results']);
      assert.notEqual(rejected.status, 0, `${job}: ${status}`);
      assert.equal(rejected.stdout, '', 'cannot emit proof from caller-supplied success');
    }
  }
});

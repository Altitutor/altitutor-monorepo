import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const command = fileURLToPath(new URL('./teaching-release.mjs', import.meta.url));
function invoke(action, input, extra = {}) {
  return spawnSync(process.execPath, [command, action], {
    input: JSON.stringify(input), encoding: 'utf8',
    env: { PATH: process.env.PATH, ...extra },
  });
}

test('signing command rejects missing credentials without exposing values', () => {
  const result = invoke('credentials', {});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing protected secret: TEACHING_DISTRIBUTION_P12_BASE64/);
  assert.equal(result.stdout, '');
});

const sourceSHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
function fixture(overrides = {}) {
  return {
    sourceSHA, workflowRef: 'refs/heads/main', backend: 'production',
    branchSHA: sourceSHA, runNumber: 41, runAttempt: 1, upload: false,
    ci: 'success', deployment: { sha: sourceSHA, status: 'success' },
    api: { sha: sourceSHA, contract: 1, authStatus: 401 },
    environment: { reviewers: [155211953], branches: ['main', 'develop'], canAdminsBypass: false },
    ...overrides,
  };
}

test('release planning accepts only a pinned source and trusted dispatch branch', () => {
  for (const overrides of [
    { sourceSHA: 'main' },
    { sourceSHA: 'a'.repeat(39) },
    { workflowRef: 'refs/heads/unreviewed' },
    { branchSHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  ]) {
    const result = invoke('plan', fixture(overrides));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Pinned source|Trusted dispatch|Current release branch/);
  }
  const result = invoke('plan', fixture());
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sourceSHA, sourceSHA);
});

test('production planning requires matching successful CI, deployment and live API', () => {
  for (const overrides of [
    { backend: 'local' }, { backend: 'production', workflowRef: 'refs/heads/develop' },
    { ci: 'failure' }, { deployment: { sha: sourceSHA, status: 'in_progress' } },
    { deployment: { sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', status: 'success' } },
    { api: { sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', contract: 1, authStatus: 401 } },
    { api: { sha: sourceSHA, contract: 1, authStatus: 200 } },
  ]) {
    const result = invoke('plan', fixture(overrides));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Backend|CI|Deployment|Tutor API/);
  }
  const production = JSON.parse(invoke('plan', fixture()).stdout);
  assert.equal(production.apiURL, 'https://tutor.altitutor.com');
  const qa = invoke('plan', fixture({ backend: 'qa', workflowRef: 'refs/heads/develop' }));
  assert.equal(qa.status, 0, qa.stderr);
  assert.equal(JSON.parse(qa.stdout).apiURL, 'https://tutor.development.altitutor.com');
});

test('every retry gets a monotonic bounded build identity and upload remains opt-in', () => {
  for (const overrides of [
    { runNumber: 0 }, { runNumber: 9000 }, { runNumber: '41' },
    { runAttempt: 0 }, { runAttempt: 100 }, { upload: 'true' },
  ]) {
    const result = invoke('plan', fixture(overrides));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Build identity|Upload must/);
  }
  const first = JSON.parse(invoke('plan', fixture()).stdout);
  const retry = JSON.parse(invoke('plan', fixture({ runAttempt: 2, upload: true })).stdout);
  const next = JSON.parse(invoke('plan', fixture({ runNumber: 42 })).stdout);
  assert.equal(first.buildNumber, '1041.1.0');
  assert.equal(retry.buildNumber, '1041.2.0');
  assert.equal(next.buildNumber, '1042.1.0');
  assert.equal(first.upload, false);
  assert.equal(retry.upload, true);
});

test('signing plan refuses an unprotected or broadly deployable environment', () => {
  for (const environment of [null, {},
    { reviewers: [], branches: ['main', 'develop'], canAdminsBypass: false },
    { reviewers: [155211953], branches: ['*'], canAdminsBypass: false },
    { reviewers: [155211953], branches: ['main', 'develop'], canAdminsBypass: true },
  ]) {
    const result = invoke('plan', fixture({ environment }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Protected Teaching environment/);
  }
});

test('an upload cannot reuse or go behind an Apple build, including ambiguous retries', () => {
  for (const existing of ['1041.1.0', '1041.2.0', '1042.1.0']) {
    const result = invoke('check-build', { buildNumber: '1041.1.0', existing: [existing] });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Build must be newer/);
  }
  const retry = invoke('check-build', { buildNumber: '1041.2.0', existing: ['1', '2', '1041.1.0'] });
  assert.equal(retry.status, 0, retry.stderr);
});

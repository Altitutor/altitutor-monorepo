import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const ARTIFACT = 'ci-integration-receipt';
export const REQUIRED_JOBS = ['validation-plan', 'lint', 'typecheck', 'test', 'ucat-contracts', 'web-e2e', 'build'];
const successfulJobs = results => REQUIRED_JOBS.every(name => results?.[name]?.result === 'success');
const sameRuntime = (actual, expected) => ['node', 'pnpm', 'deno', 'supabaseSetup'].every(key => typeof expected?.[key] === 'string' && actual?.[key] === expected[key]);
function expectedRuntime() {
  return { node: readFileSync('.nvmrc', 'utf8').trim().replace(/^v/, ''), pnpm: JSON.parse(readFileSync('package.json', 'utf8')).packageManager.split('@')[1], deno: '2.9.6', supabaseSetup: '2.107.0' };
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = value => createHash('sha256').update(value).digest('hex');

// Bind the entire input tree, including workflow, lockfiles, environment policy,
// toolchain declarations and test inventory. No build artifact is reused.
export function createReceipt(plan, { head, tree, runtime, expected, results }) {
  if (plan.event !== 'merge_group' || !SHA.test(plan.base) || !SHA.test(plan.head) || !SHA.test(head) || !SHA.test(tree)) {
    throw new Error('A resolved merge-group plan and actual checkout identity are required');
  }
  if (!sameRuntime(runtime, expected)) throw new Error('Toolchain differs from pinned declarations');
  if (!successfulJobs(results)) throw new Error('Missing or unsuccessful required validation');
  return { version: 1, policy: 'integration-tree-v1', head, tree, base: plan.base,
    planHead: plan.head, profile: plan.profile, inputFingerprint: hash(tree),
    runtime, results, plan };
}

export function acceptsReceipt(receipt, { run, tree, expected, baseIsAncestor }) {
  return Boolean(receipt && receipt.version === 1 && receipt.policy === 'integration-tree-v1'
    && run.event === 'merge_group' && run.status === 'completed' && run.conclusion === 'success'
    && run.path === '.github/workflows/ci.yml' && SHA.test(run.head_sha)
    && receipt.head === run.head_sha && receipt.tree === tree
    && receipt.inputFingerprint === hash(tree) && sameRuntime(receipt.runtime, expected) && successfulJobs(receipt.results)
    && SHA.test(receipt.base) && receipt.plan?.event === 'merge_group'
    && receipt.plan.base === receipt.base && receipt.plan.head === receipt.planHead
    && receipt.planHead === receipt.head && baseIsAncestor);
}

export function acceptsArtifact(artifact, run) {
  return Boolean(artifact && artifact.name === ARTIFACT && artifact.expired === false
    && artifact.size_in_bytes > 0 && artifact.size_in_bytes < 1024 * 1024
    && Number.isSafeInteger(artifact.id) && /^sha256:[a-f0-9]{64}$/.test(artifact.digest)
    && artifact.workflow_run?.id === run.id && artifact.workflow_run?.head_sha === run.head_sha);
}

export function acceptsArchive(artifact, bytes) { return artifact.digest === `sha256:${hash(bytes)}`; }

function api(endpoint, binary = false) {
  return execFileSync('gh', ['api', endpoint], { encoding: binary ? undefined : 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 30_000 });
}
function json(endpoint) { return JSON.parse(api(endpoint)); }

export function findReusableRun({ repository, head, expected }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !SHA.test(head)) throw new Error('Invalid repository or source identity');
  const tree = git('rev-parse', `${head}^{tree}`);
  const parent = git('rev-parse', `${head}^`);
  const workflow = json(`repos/${repository}/actions/workflows/ci.yml`);
  const runs = json(`repos/${repository}/actions/workflows/ci.yml/runs?event=merge_group&status=success&per_page=30`).workflow_runs;
  for (const run of runs) {
    if (run.workflow_id !== workflow.id || run.head_repository?.full_name !== repository || run.path !== '.github/workflows/ci.yml') continue;
    const commit = json(`repos/${repository}/git/commits/${run.head_sha}`);
    if (commit.tree?.sha !== tree) continue;
    const artifacts = json(`repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts;
    const artifact = artifacts.find(item => acceptsArtifact(item, run));
    if (!artifact || !Number.isSafeInteger(artifact.id)) continue;
    const directory = mkdtempSync(join(tmpdir(), 'integration-receipt-'));
    try {
      const archive = join(directory, 'receipt.zip');
      const bytes = api(`repos/${repository}/actions/artifacts/${artifact.id}/zip`, true);
      if (!acceptsArchive(artifact, bytes)) continue;
      writeFileSync(archive, bytes);
      const receipt = JSON.parse(execFileSync('unzip', ['-p', archive, 'integration-receipt.json'], { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 10_000 }));
      let baseIsAncestor = false;
      try { git('merge-base', '--is-ancestor', receipt.base, parent); baseIsAncestor = true; } catch { /* Unknown objects also require verification. */ }
      if (acceptsReceipt(receipt, { run, tree, expected, baseIsAncestor })) return String(run.id);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
  return null;
}

function main() {
  const mode = process.argv[2];
  const arg = name => process.argv[process.argv.indexOf(name) + 1];
  if (mode === 'create') {
    const plan = JSON.parse(readFileSync(arg('--plan'), 'utf8'));
    const receipt = createReceipt(plan, { head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), expected: expectedRuntime(), results: JSON.parse(process.env.CI_REQUIRED_RESULTS || '{}'), runtime: { node: process.version.replace(/^v/, ''), pnpm: execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(), deno: execFileSync('deno', ['--version'], { encoding: 'utf8' }).split(/\s+/)[1], supabaseSetup: execFileSync('supabase', ['--version'], { encoding: 'utf8' }).trim() } });
    writeFileSync(arg('--output'), `${JSON.stringify(receipt, null, 2)}\n`);
  } else if (mode === 'reuse') {
    let run = null;
    if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/develop') {
      try { run = findReusableRun({ repository: process.env.GITHUB_REPOSITORY, head: process.env.GITHUB_SHA, expected: expectedRuntime() }); }
      catch { console.log('Trusted integration evidence unavailable; running verification.'); }
    }
    appendFileSync(process.env.GITHUB_OUTPUT, `reuse=${Boolean(run)}\nrun_id=${run ?? ''}\n`);
    console.log(run ? `Reusing successful integration verification run ${run}.` : 'No matching integration evidence; running verification.');
  } else throw new Error('Expected create or reuse');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

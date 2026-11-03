import { pathToFileURL } from 'node:url';
import { appendFile, writeFile } from 'node:fs/promises';

const repository = 'Altitutor/altitutor-monorepo';
const environmentName = 'teaching-release';
const origins = { production: 'https://tutor.altitutor.com', qa: 'https://tutor.development.altitutor.com' };

async function jsonRequest(url, token) {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } : {},
    redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Release evidence unavailable (HTTP ${response.status})`);
  return response.json();
}

async function verify() {
  const env = process.env;
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REPOSITORY !== repository) throw new Error('Only this repository manual dispatch may release');
  if (!/^[a-f0-9]{40}$/.test(env.TEACHING_SOURCE_SHA ?? '') || !['main', 'develop'].includes(env.GITHUB_REF_NAME)) throw new Error('Pinned source or trusted dispatch is invalid');
  if (!Object.hasOwn(origins, env.TEACHING_BACKEND)) throw new Error('Backend is invalid');
  if (!env.GH_TOKEN) throw new Error('Read-only GitHub evidence token is missing');
  const github = (path) => jsonRequest(`https://api.github.com/repos/${repository}/${path}`, env.GH_TOKEN);
  const [branch, ci, deploy, environment, branchRules] = await Promise.all([
    github(`branches/${env.TEACHING_BACKEND === 'production' ? 'main' : 'develop'}`),
    github(`actions/workflows/ci.yml/runs?head_sha=${env.TEACHING_SOURCE_SHA}&per_page=1`),
    github(`actions/workflows/supabase-deploy.yml/runs?head_sha=${env.TEACHING_SOURCE_SHA}&per_page=1`),
    github(`environments/${environmentName}`),
    github(`environments/${environmentName}/deployment-branch-policies?per_page=100`),
  ]);
  const apiURL = origins[env.TEACHING_BACKEND];
  const [api, auth] = await Promise.all([
    jsonRequest(`${apiURL}/api/teaching/release`),
    fetch(`${apiURL}/api/teaching/sessions`, { redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' }),
  ]);
  const reviewers = environment.protection_rules?.find((rule) => rule.type === 'required_reviewers')?.reviewers ?? [];
  const rules = branchRules.branch_policies ?? [];
  const input = {
    sourceSHA: env.TEACHING_SOURCE_SHA, workflowRef: env.GITHUB_REF,
    backend: env.TEACHING_BACKEND, branchSHA: branch.commit?.sha,
    runNumber: Number(env.GITHUB_RUN_NUMBER), runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    upload: env.TEACHING_UPLOAD === 'true', ci: ci.workflow_runs?.[0]?.conclusion,
    deployment: { sha: deploy.workflow_runs?.[0]?.head_sha, status: deploy.workflow_runs?.[0]?.conclusion },
    api: { ...api, authStatus: auth.status },
    environment: {
      reviewers: reviewers.filter((reviewer) => reviewer.type === 'User').map((reviewer) => reviewer.reviewer?.id),
      canAdminsBypass: environment.can_admins_bypass,
      branches: environment.deployment_branch_policy?.custom_branch_policies === true && rules.every((rule) => rule.type === 'branch')
        ? rules.map((rule) => rule.name) : [],
    },
  };
  if (!['true', 'false'].includes(env.TEACHING_UPLOAD)) throw new Error('Upload must be explicitly true or false');
  const result = { ...plan(input), runID: env.GITHUB_RUN_ID, runNumber: input.runNumber, runAttempt: input.runAttempt,
    workflowSHA: env.GITHUB_SHA, verifiedAt: new Date().toISOString(),
    deploymentRun: deploy.workflow_runs[0].html_url };
  if (env.TEACHING_PLAN_PATH) await writeFile(env.TEACHING_PLAN_PATH, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `source_sha=${result.sourceSHA}\nbuild_number=${result.buildNumber}\n`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}


const secretNames = [
  'TEACHING_DISTRIBUTION_P12_BASE64', 'TEACHING_DISTRIBUTION_P12_PASSWORD',
  'TEACHING_PROFILE_BASE64', 'TEACHING_ASC_PRIVATE_KEY',
  'TEACHING_ASC_KEY_ID', 'TEACHING_ASC_ISSUER_ID',
];

function credentials(env) {
  for (const name of secretNames) {
    if (!env[name]?.trim()) throw new Error(`Missing protected secret: ${name}`);
  }
}

function plan(input) {
  if (!/^[a-f0-9]{40}$/.test(input.sourceSHA ?? '')) throw new Error('Pinned source must be a full lowercase commit SHA');
  if (!['refs/heads/main', 'refs/heads/develop'].includes(input.workflowRef)) throw new Error('Trusted dispatch branch must be main or develop');
  if (input.sourceSHA !== input.branchSHA) throw new Error('Current release branch does not match the pinned source');
  const branches = { production: 'refs/heads/main', qa: 'refs/heads/develop' };
  if (!Object.hasOwn(branches, input.backend) || input.workflowRef !== branches[input.backend]) throw new Error('Backend must match its trusted dispatch branch');
  if (input.ci !== 'success') throw new Error('CI must pass for the pinned source');
  if (input.deployment?.sha !== input.sourceSHA || input.deployment?.status !== 'success') throw new Error('Deployment must succeed for the pinned source');
  if (input.api?.sha !== input.sourceSHA || input.api?.contract !== 1 || input.api?.authStatus !== 401) throw new Error('Tutor API identity or authentication boundary does not match');
  if (!Number.isInteger(input.runNumber) || input.runNumber < 1 || input.runNumber > 8999 ||
      !Number.isInteger(input.runAttempt) || input.runAttempt < 1 || input.runAttempt > 99) throw new Error('Build identity exceeds its supported run/attempt bounds');
  if (typeof input.upload !== 'boolean') throw new Error('Upload must be an explicit boolean');
  const environment = input.environment;
  if (!environment?.reviewers?.includes(155211953) || environment.canAdminsBypass !== false ||
      !Array.isArray(environment.branches) || environment.branches.length !== 2 ||
      !['main', 'develop'].every((branch) => environment.branches.includes(branch))) throw new Error('Protected Teaching environment must require the owner and only main/develop without bypass');
  return { sourceSHA: input.sourceSHA, backend: input.backend,
    buildNumber: `${1000 + input.runNumber}.${input.runAttempt}.0`, upload: input.upload,
    apiURL: input.backend === 'production' ? 'https://tutor.altitutor.com' : 'https://tutor.development.altitutor.com' };

}

function checkBuild({ buildNumber, existing }) {
  const parts = (value) => {
    if (typeof value !== 'string' || !/^[0-9]{1,4}(\.[0-9]{1,2}){0,2}$/.test(value)) throw new Error('Build must be newer: unsupported Apple build identity');
    const numbers = value.split('.').map(Number);
    while (numbers.length < 3) numbers.push(0);
    return numbers;
  };
  const proposed = parts(buildNumber);
  if (!Array.isArray(existing)) throw new Error('Build must be newer: missing Apple history');
  for (const version of existing) {
    const prior = parts(version);
    const difference = proposed.map((number, index) => number - prior[index]).find((number) => number !== 0) ?? 0;
    if (difference <= 0) throw new Error('Build must be newer than every existing Apple build; inspect ambiguous uploads before retrying');
  }
}

async function readInput() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 32768) throw new Error('Release evidence is too large');
  }
  return JSON.parse(input);
}

async function main() {
  if (process.argv[2] === 'cleanup') { const { cleanupRelease } = await import('./teaching-release-build.mjs'); await cleanupRelease(); return; }
  if (process.argv[2] === 'release') {
    credentials(process.env);
    const verified = await verify();
    const { runRelease } = await import('./teaching-release-build.mjs');
    await runRelease(verified, checkBuild);
    return;
  }
  if (process.argv[2] === 'verify') { await verify(); return; }
  if (process.argv[2] === 'check-build') { checkBuild(await readInput()); console.log('Build identity is newer.'); return; }
  if (process.argv[2] === 'plan') { console.log(JSON.stringify(plan(await readInput()))); return; }
  if (process.argv[2] !== 'credentials') throw new Error('Unknown Teaching release command');
  credentials(process.env);
  console.log('Protected credentials are present; no signing or upload performed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

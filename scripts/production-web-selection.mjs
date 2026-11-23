import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { checkedOutIdentity, gitChangedFiles } from "./validation-plan.mjs";

const SHA = /^[a-f0-9]{40}$/u;
const WORKFLOW_PATH = ".github/workflows/supabase-deploy.yml";
const PRODUCTION_WEB = [
  { app: "admin-web", project_id: "prj_1MrhFCZC9LsYMqN3hTrjtPaOSf0e" },
  { app: "marketing-web", project_id: "prj_Qf1yqSGW3ttj2lZvNzuxIABiLkfT" },
  { app: "student-web", project_id: "prj_i1beD28400IZOFp0WRtzmFldEifZ" },
  { app: "tutor-web", project_id: "prj_vGAe2xH6lLRm05mxZkFbFTXfDthi" },
  { app: "ucat-web", project_id: "prj_xkqIaXkZGO2EvA3cIoXyl9vLeGJX" },
];
const NATIVE_ONLY = /^apps\/(?:(?:student|tutor|ucat)-app|teaching-ipad)\//u;

export function planProductionWebRelease({
  event, baseline, head, cwd, rerun = false, changedFiles = gitChangedFiles,
}) {
  if (event !== "push") return { deployments: PRODUCTION_WEB, reason: "full-manual-release" };
  if (rerun) return { deployments: PRODUCTION_WEB, reason: "full-rerun-release" };
  if (!SHA.test(baseline ?? "") || !SHA.test(head ?? "")) {
    return { deployments: PRODUCTION_WEB, reason: "release-baseline-unavailable" };
  }

  let files;
  try {
    files = changedFiles(baseline, head, cwd);
  } catch {
    return { deployments: PRODUCTION_WEB, reason: "release-history-unavailable-or-divergent" };
  }

  const affected = new Set();
  for (const file of files) {
    const web = PRODUCTION_WEB.find(({ app }) => file.startsWith(`apps/${app}/`));
    if (web) {
      affected.add(web.app);
    } else if (!NATIVE_ONLY.test(file)) {
      // Includes all shared packages, workspace config, migrations, release
      // tooling and any path whose build dependencies are unknown.
      return { deployments: PRODUCTION_WEB, reason: "shared-or-unclassified-change" };
    }
  }
  return {
    deployments: PRODUCTION_WEB.filter(({ app }) => affected.has(app)),
    reason: affected.size ? "affected-web-apps" : "no-web-changes",
  };
}

export function findProductionWebBaseline({ repository, currentRunId, runs, jobsForAttempt }) {
  const history = runs.filter((run) =>
    run.id !== currentRunId && run.head_branch === "main" && run.path === WORKFLOW_PATH &&
    run.repository?.full_name === repository && run.head_repository?.full_name === repository &&
    ["push", "workflow_dispatch"].includes(run.event));
  if (history.some((run) =>
    !Number.isSafeInteger(run.id) || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 ||
    run.status !== "completed" || !SHA.test(run.head_sha ?? "") ||
    !Number.isFinite(Date.parse(run.updated_at)))) return null;

  // Releases share the main concurrency lock. A rerun of an older commit may
  // have finished after a newer commit's original run and changed what is live.
  const completed = history.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
  for (const [index, run] of completed.entries()) {
    if (Date.parse(run.updated_at) === Date.parse(completed[index + 1]?.updated_at)) return null;

    const jobs = jobsForAttempt(run.id, run.run_attempt);
    const succeeded = (name) => jobs.some((job) =>
      job.name === name && job.status === "completed" && job.conclusion === "success");
    // Mobile delivery and Sentry happen after this point and can fail separately.
    const passedDatabaseGate = succeeded("deploy");
    if (passedDatabaseGate && succeeded("Smoke production web apps")) return run.head_sha;

    // A failed matrix can promote only some apps. Even reverting its commit
    // in Git leaves those apps changed in production until they are redeployed.
    // A partial rerun can omit jobs that ran in its earlier attempts.
    if (passedDatabaseGate || run.run_attempt > 1) return null;
  }
  return null;
}

function githubJson(path) {
  return JSON.parse(execFileSync("gh", ["api", path], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
  }));
}

function main() {
  const event = process.env.GITHUB_EVENT_NAME;
  const head = process.env.GITHUB_SHA;
  const repository = process.env.GITHUB_REPOSITORY;
  const rerun = process.env.GITHUB_RUN_ATTEMPT !== "1";
  let baseline = null;
  if (event === "push" && !rerun && checkedOutIdentity().commit === head) {
    try {
      const workflow = WORKFLOW_PATH.split("/").at(-1);
      // GitHub allows reruns for 30 days and a workflow can then live for
      // up to 35 days. A truncated history could hide an older rerun.
      const oldest = encodeURIComponent(`>=${new Date(Date.now() - 65 * 86_400_000).toISOString()}`);
      const { workflow_runs: runs, total_count: total } = githubJson(
        `repos/${repository}/actions/workflows/${workflow}/runs?branch=main&status=completed&created=${oldest}&per_page=100`,
      );
      if (total !== runs.length) throw new Error("Incomplete release history");
      baseline = findProductionWebBaseline({
        repository,
        currentRunId: Number(process.env.GITHUB_RUN_ID),
        runs,
        jobsForAttempt: (id, attempt) => {
          const { jobs, total_count: jobCount } = githubJson(
            `repos/${repository}/actions/runs/${id}/attempts/${attempt}/jobs?per_page=100`,
          );
          if (jobCount !== jobs.length) throw new Error("Incomplete release attempt");
          return jobs;
        },
      });
    } catch {
      console.log("Release history could not be verified. Selecting every web app.");
    }
  }
  const { deployments, reason } = planProductionWebRelease({ event, head, baseline, rerun });
  appendFileSync(process.env.GITHUB_OUTPUT,
    `deployments=${JSON.stringify(deployments)}\nhas_builds=${deployments.length > 0}\n`);
  const planned = deployments.map(({ app }) => app).join(", ") || "none";
  const summary = `Production web builds: ${planned} (${reason}, baseline ${baseline ?? "unavailable"}).`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

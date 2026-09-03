import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const APP_PATHS = {
  admin: /^apps\/admin-web(?:\/|$)/u,
  marketing: /^apps\/marketing-web(?:\/|$)/u,
  student: /^apps\/student-web(?:\/|$)/u,
  tutor: /^apps\/tutor-web(?:\/|$)/u,
  ucat: /^apps\/ucat-web(?:\/|$)/u,
};

const SHARED_WEB_PATHS = [
  /^packages\//u,
  /^pnpm-lock\.yaml$/u,
  /^pnpm-workspace\.yaml$/u,
  /^package\.json$/u,
  /^turbo\.json$/u,
  /^\.github\/workflows\/ci\.yml$/u,
  /^\.github\/workflows\/supabase-deploy\.yml$/u,
  /^scripts\/web-system-test-paths(?:\.test)?\.mjs$/u,
  /^scripts\/(?:production-web|ucat-production)-smoke(?:\.test)?\.mjs$/u,
  /^scripts\/production-release-gate\.test\.mjs$/u,
  /^scripts\/checkall\.sh$/u,
];

function emptyApps() {
  return Object.fromEntries(Object.keys(APP_PATHS).map((app) => [app, false]));
}

export function decideWebSystemTests(changedFiles) {
  const apps = emptyApps();
  const sharedChange = changedFiles.some((file) =>
    SHARED_WEB_PATHS.some((pattern) => pattern.test(file)),
  );
  const database = changedFiles.some((file) => /^supabase(?:\/|$)/u.test(file));

  if (sharedChange) {
    for (const app of Object.keys(apps)) apps[app] = true;
  } else {
    for (const [app, pattern] of Object.entries(APP_PATHS)) {
      apps[app] = changedFiles.some((file) => pattern.test(file));
    }
  }

  if (database) {
    apps.admin = true;
    apps.student = true;
    apps.tutor = true;
    apps.ucat = true;
  }

  return {
    run: database || Object.values(apps).some(Boolean),
    database,
    apps,
  };
}

export function allWebSystemTests() {
  const apps = emptyApps();
  for (const app of Object.keys(apps)) apps[app] = true;
  return { run: true, database: true, apps };
}

export function changedFilesForGitRange(range) {
  const output = execFileSync("git", ["diff", "--name-only", range], {
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function printGithubOutputs(decision) {
  process.stdout.write(`run=${decision.run}\n`);
  process.stdout.write(`database=${decision.database}\n`);
  for (const [app, selected] of Object.entries(decision.apps)) {
    process.stdout.write(`${app}=${selected}\n`);
  }
}

const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const gitDiffIndex = args.indexOf("--git-diff");
  const changedFiles =
    gitDiffIndex >= 0
      ? changedFilesForGitRange(args[gitDiffIndex + 1])
      : args.filter((arg) => !arg.startsWith("--"));
  const decision = all
    ? allWebSystemTests()
    : decideWebSystemTests(changedFiles);
  printGithubOutputs(decision);
}

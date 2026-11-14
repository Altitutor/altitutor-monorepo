import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { allWebSystemTests, decideValidationDomains } from "./web-system-test-paths.mjs";

const SHA = /^[a-f0-9]{40}$/u;

export function eventRange(eventName, event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return {};
  if (eventName === "pull_request") return { base: event.pull_request?.base?.sha, head: event.pull_request?.head?.sha };
  if (eventName === "merge_group") return { base: event.merge_group?.base_sha, head: event.merge_group?.head_sha };
  if (eventName === "push") return { base: event.before, head: event.after };
  return {};
}

export function gitChangedFiles(base, head, cwd = process.cwd()) {
  for (const sha of [base, head]) {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: "pipe" });
  }
  execFileSync("git", ["merge-base", "--is-ancestor", base, head], { cwd, stdio: "pipe" });
  // Two-dot tree comparison includes every PR/group change, including deletions
  // and the old side of renames. Never fall back to the last commit of a group.
  return execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", `${base}..${head}`, "--"], { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\0").filter(Boolean);
}

export function checkedOutIdentity(cwd = process.cwd()) {
  try {
    const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return { commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}") };
  } catch { return { commit: null, tree: null }; }
}

export function createValidationPlan({ eventName, event = {}, all = false, changedFiles = gitChangedFiles, identity = checkedOutIdentity }) {
  const { base, head } = eventRange(eventName, event);
  const validRange = SHA.test(base ?? "") && SHA.test(head ?? "") && base !== head && !/^0+$/u.test(base) && !/^0+$/u.test(head);
  let files = [];
  let fullReason = all ? "explicit-full" : !validRange ? "missing-or-invalid-event-range" : null;
  if (!fullReason) {
    try { files = changedFiles(base, head); }
    catch { fullReason = "unavailable-or-divergent-event-range"; }
    if (!fullReason && files.length === 0) fullReason = "empty-event-diff";
  }
  const selection = fullReason
    ? { ...allWebSystemTests(), ucat_coverage: true, edge: true, reason: fullReason }
    : decideValidationDomains(files);
  const full = fullReason !== null || selection.reason === "unclassified-or-shared-runtime";
  const { apps, ...gates } = selection;
  return {
    version: 1,
    event: eventName,
    base: SHA.test(base ?? "") ? base : null,
    head: SHA.test(head ?? "") ? head : null,
    profile: full ? "full" : "affected",
    checkout: identity(),
    turbo_filter: full ? "" : `...[${base}...${head}]`,
    files,
    ...gates,
    teaching_ipad: full || files.some((file) => /^apps\/teaching-ipad\//u.test(file)),
    supabase_types: full || files.some((file) => /^supabase\/migrations\//u.test(file) || /(?:^|\/)generated\.ts$/u.test(file)),
    apps: Object.keys(apps).filter((app) => apps[app]),
    app_flags: apps,
    exclusions: [
      ...Object.keys(apps).filter((app) => !apps[app]).map((app) => ({ gate: `browser:${app}`, reason: "outside-classified-domain" })),
      ...["database", "ucat_coverage", "edge"].filter((gate) => !gates[gate]).map((gate) => ({ gate, reason: "outside-classified-domain" })),
    ],
  };
}

export function githubOutputs(plan) {
  const fields = { base: plan.base ?? "", head: plan.head ?? "", checkout_commit: plan.checkout.commit ?? "", checkout_tree: plan.checkout.tree ?? "", profile: plan.profile, reason: plan.reason, turbo_filter: plan.turbo_filter, run: plan.run, database: plan.database, ucat_coverage: plan.ucat_coverage, edge: plan.edge, teaching_ipad: plan.teaching_ipad, supabase_types: plan.supabase_types, apps: JSON.stringify(plan.apps), ...plan.app_flags };
  return Object.entries(fields).map(([name, value]) => `${name}=${value}`).join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  let event = {};
  try { event = JSON.parse(readFileSync(value("--event-path", process.env.GITHUB_EVENT_PATH), "utf8")); }
  catch { /* Missing/unreadable event data selects the full profile. */ }
  const plan = createValidationPlan({ eventName: value("--event-name", process.env.GITHUB_EVENT_NAME), event, all: args.includes("--all") || process.env.INPUT_FULL_RUN === "true" || event?.inputs?.full_run === true || event?.inputs?.full_run === "true" });
  process.stdout.write(args.includes("--github-output") ? githubOutputs(plan) : JSON.stringify(plan, null, 2) + "\n");
}

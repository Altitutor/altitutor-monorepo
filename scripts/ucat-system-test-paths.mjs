import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const UCAT_SYSTEM_TEST_PATHS = [
  /^apps\/ucat-web(?:\/|$)/u,
  /^packages\//u,
  /^supabase\//u,
  /^pnpm-lock\.yaml$/u,
  /^pnpm-workspace\.yaml$/u,
  /^package\.json$/u,
  /^turbo\.json$/u,
  /^\.github\/workflows\/ci\.yml$/u,
  /^scripts\/ucat-system-test-paths\.mjs$/u,
  /^scripts\/checkall\.sh$/u,
];

export function shouldRunUcatSystemTests(changedFiles) {
  return changedFiles.some((file) =>
    UCAT_SYSTEM_TEST_PATHS.some((pattern) => pattern.test(file)),
  );
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

function printRunDecision(changedFiles) {
  const run = shouldRunUcatSystemTests(changedFiles);
  process.stdout.write(`${run ? "true" : "false"}\n`);
}

const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  if (process.argv[2] === "--git-diff") {
    const range = process.argv[3];
    if (!range) {
      throw new Error("Usage: node scripts/ucat-system-test-paths.mjs --git-diff <range>");
    }
    printRunDecision(changedFilesForGitRange(range));
  } else {
    printRunDecision(process.argv.slice(2));
  }
}

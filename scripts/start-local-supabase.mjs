import { spawn, execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 10_000;

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function hostedCiProject() {
  const repository = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  if (
    process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true" ||
    process.env.RUNNER_ENVIRONMENT !== "github-hosted" || !process.env.GITHUB_RUN_ID ||
    !process.env.RUNNER_WORKSPACE || !process.env.GITHUB_WORKSPACE ||
    realpathSync(process.env.GITHUB_WORKSPACE) !== repository ||
    !repository.startsWith(realpathSync(process.env.RUNNER_WORKSPACE) + path.sep) ||
    realpathSync(process.cwd()) !== repository
  ) {
    throw new Error("Local startup is blocked; use the owned disposable database workflow.");
  }
  const config = readFileSync(path.join(repository, "supabase/config.toml"), "utf8");
  const project = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"\s*$/mu)?.[1];
  if (!project) throw new Error("Exact hosted CI project identity is required.");
  return { repository, project };
}

function runSupabaseStart(args) {
  const { repository } = hostedCiProject();
  if (args.some((arg) => /^(--workdir|--project-id|--all)(=|$)/u.test(arg))) {
    throw new Error("CI startup cannot override its owned project/workdir.");
  }
  return runCommand("supabase", ["--workdir", repository, "start", ...args]);
}

async function cleanUpPartialStart() {
  const { repository, project } = hostedCiProject();
  try {
    const label = execFileSync("docker", ["inspect", "--format",
      '{{index .Config.Labels "com.supabase.cli.project"}}', `supabase_db_${project}`],
      { encoding: "utf8" }).trim();
    if (label !== project) throw new Error("Hosted CI database project label mismatch.");
    await runCommand("supabase", ["--workdir", repository, "stop", "--project-id", project, "--no-backup"]);
  } catch {
    // A failed start may not have created enough state for `supabase stop`.
  }
}

export async function startLocalSupabase({
  args = [],
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  runStart = runSupabaseStart,
  cleanup = cleanUpPartialStart,
  wait: waitForRetry = wait,
  log = (message) => console.warn(message),
} = {}) {
  if (runStart === runSupabaseStart) hostedCiProject();
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new TypeError("attempts must be a positive integer");
  }

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const exitCode = await runStart(args);
      if (exitCode === 0) return;
      lastError = new Error(`supabase start exited with code ${exitCode}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt === attempts) break;

    log(
      `supabase start failed (attempt ${attempt}/${attempts}); cleaning up and retrying in ${delayMs}ms`,
    );
    await cleanup();
    await waitForRetry(delayMs);
  }

  throw new Error(`supabase start failed after ${attempts} attempts`, {
    cause: lastError,
  });
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    await startLocalSupabase({ args: process.argv.slice(2) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

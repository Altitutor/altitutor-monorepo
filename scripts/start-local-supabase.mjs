import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 10_000;

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function runSupabaseStart(args) {
  return runCommand("supabase", ["start", ...args]);
}

async function cleanUpPartialStart() {
  try {
    await runCommand("supabase", ["stop", "--no-backup"]);
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

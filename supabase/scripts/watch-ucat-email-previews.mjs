import { watch } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const workspace = process.cwd();
const previewScript = resolve(
  workspace,
  "supabase/scripts/preview-ucat-emails.mjs",
);
const watchedDirectories = [
  "supabase/functions/_shared",
  "supabase/functions/ucat-lifecycle-emails",
  "supabase/functions/ucat-transactional-email-dispatch",
  "supabase/functions/stripe-webhooks/shared",
  "supabase/templates",
  "supabase/scripts",
].map((path) => resolve(workspace, path));

let child;
let restartTimer;
let restarting = false;
let stopping = false;

function startPreview() {
  child = spawn(process.execPath, [previewScript], {
    cwd: workspace,
    env: {
      ...process.env,
      UCAT_EMAIL_PREVIEW_VERSION: `${Date.now()}`,
    },
    stdio: "inherit",
  });

  child.once("exit", (code, signal) => {
    child = undefined;
    if (!stopping && !restarting && !restartTimer) {
      console.warn(
        `[email-preview] Preview exited (${signal ?? code}); restarting.`,
      );
      restartTimer = setTimeout(() => {
        restartTimer = undefined;
        startPreview();
      }, 300);
    }
  });
}

function restartPreview(path) {
  if (stopping) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = undefined;
    console.log(`[email-preview] ${path} changed; refreshing previews.`);
    if (!child) {
      startPreview();
      return;
    }
    restarting = true;
    child.once("exit", () => {
      restarting = false;
      startPreview();
    });
    child.kill("SIGTERM");
  }, 120);
}

const watchers = watchedDirectories.map((directory) =>
  watch(directory, (eventType, filename) => {
    if (!filename) return;
    const path = filename.toString();
    if (!/\.(?:html|mjs|ts)$/.test(path)) return;
    restartPreview(path);
  })
);

function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  for (const watcher of watchers) watcher.close();
  if (child) child.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

startPreview();

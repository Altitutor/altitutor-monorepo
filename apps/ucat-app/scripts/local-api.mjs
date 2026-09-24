import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../../..", import.meta.url));
const local = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], { cwd, encoding: "utf8" }),
);
if (
  !local.API_URL ||
  !["127.0.0.1", "localhost"].includes(new URL(local.API_URL).hostname)
) {
  throw new Error("Start the repository's local Supabase stack first.");
}
// Explicit overrides prevent an existing web .env.local from selecting a remote DB.
const child = spawn("pnpm", ["--filter", "ucat-web", "dev", "--port", "3016"], {
  cwd,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-ucat-native",
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: "",
    SENTRY_DSN: "",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});

import { execFileSync } from "node:child_process";
import path from "node:path";

export default function globalSetup() {
  if (process.env.CI) return;

  const repositoryRoot = path.resolve(__dirname, "../../..");
  execFileSync(
    "bash",
    [path.join(repositoryRoot, "supabase/scripts/apply-ucat-test-seed.sh")],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}

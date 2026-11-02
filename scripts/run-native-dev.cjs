const { spawn } = require("node:child_process");

const [packageName, port] = process.argv.slice(2);

if (!packageName || !port) {
  throw new Error("Expected the native app package name and Metro port.");
}

// Root Turbo runs already have the matching web task as a sidecar. Direct
// package-script runs delegate to a Turbo task so they get the same sidecar.
const isTurboTask = Boolean(process.env.TURBO_HASH);
const command = isTurboTask ? "expo" : "turbo";
const args = isTurboTask
  ? ["start", "--go", "--port", port]
  : ["run", "native:dev", `--filter=${packageName}`];

const child = spawn(command, args, { stdio: "inherit" });

child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});

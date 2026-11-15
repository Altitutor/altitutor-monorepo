import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { freemem, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const MiB = 1024 * 1024;

export function run(command, args, timeout = 15_000) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    ok: !result.error && result.status === 0,
    output: result.stdout?.trim() ?? "",
  };
}

export function inside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export function dependencyProblems(root) {
  // Compare canonical paths on both sides (macOS /var aliases /private/var).
  root = realpathSync(root);
  const problems = [];
  const workspaces = [root];
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(path.join(root, group), {
      withFileTypes: true,
    })) {
      if (
        entry.isDirectory() &&
        existsSync(path.join(root, group, entry.name, "package.json"))
      ) {
        workspaces.push(path.join(root, group, entry.name));
      }
    }
  }
  for (const workspace of workspaces) {
    const modules = path.join(workspace, "node_modules");
    if (!existsSync(modules)) {
      // pnpm's configured hoisted linker legitimately omits workspace-local
      // directories when all dependencies resolve through this checkout's root.
      if (workspace === root)
        problems.push(
          "Root dependencies missing; run an isolated frozen install",
        );
      continue;
    }
    for (const candidate of [modules, path.join(modules, ".bin")]) {
      if (existsSync(candidate) && !inside(root, realpathSync(candidate))) {
        problems.push(
          `${path.relative(root, candidate)} resolves outside this checkout`,
        );
      }
    }
    const bins = path.join(modules, ".bin");
    if (existsSync(bins)) {
      for (const executable of readdirSync(bins)) {
        try {
          if (!inside(root, realpathSync(path.join(bins, executable))))
            problems.push(
              `${path.relative(root, bins)}/${executable} resolves outside this checkout`,
            );
        } catch {
          problems.push(
            `${path.relative(root, bins)}/${executable} has a broken target`,
          );
        }
      }
    }
  }
  for (const tool of ["turbo", "eslint", "typescript", "supabase"]) {
    const installed = path.join(root, "node_modules", tool);
    if (!existsSync(installed) || !inside(root, realpathSync(installed))) {
      problems.push(`${tool} must resolve within this checkout's install`);
    }
  }
  return problems;
}

function darwinAvailableMemory(output, total) {
  const header = [
    ...output.matchAll(
      /^Mach Virtual Memory Statistics: \(page size of (\d+) bytes\)\s*$/gmu,
    ),
  ];
  if (header.length !== 1) return null;
  const pageSize = Number(header[0][1]);
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize <= 0 ||
    !Number.isSafeInteger(total) ||
    total <= 0
  )
    return null;
  const pages = [];
  for (const name of ["Pages free", "Pages inactive", "File-backed pages"]) {
    const matches = [
      ...output.matchAll(new RegExp(`^${name}:\\s+(\\d+)\\.\\s*$`, "gmu")),
    ];
    if (matches.length !== 1) return null;
    const count = Number(matches[0][1]);
    if (!Number.isSafeInteger(count)) return null;
    pages.push(count);
  }
  // vm_stat's inactive and file-backed categories overlap. Bound reclaim credit
  // by both rather than assuming all inactive anonymous memory is available.
  // This is an estimate, not their exact intersection. Speculative/purgeable
  // counters overlap other categories and receive no additional credit.
  const bytes = (pages[0] + Math.min(pages[1], pages[2])) * pageSize;
  return Number.isSafeInteger(bytes) ? Math.min(bytes, total) : null;
}

export function availableMemory({
  hostFree = freemem(),
  hostTotal = totalmem(),
  platform = process.platform,
  command = run,
  read = readFileSync,
} = {}) {
  if (platform === "darwin") {
    const pressure = command(
      "/usr/sbin/sysctl",
      ["-n", "kern.memorystatus_vm_pressure_level"],
      2000,
    );
    // Darwin kernel pressure levels: normal=1, warning=2, critical=4. Refuse
    // heavy work under reported pressure, even if unused RAM alone looks ample.
    if (pressure.ok && ["2", "4"].includes(pressure.output.trim())) return 0;
    if (!pressure.ok || pressure.output.trim() !== "1") return hostFree;
    const stats = command("/usr/bin/vm_stat", [], 2000);
    return stats.ok
      ? (darwinAvailableMemory(stats.output, hostTotal) ?? hostFree)
      : hostFree;
  }
  if (platform !== "linux") return hostFree;
  // Node reports host memory; a Linux container can have a smaller cgroup budget.
  let available = hostFree;
  for (const [limitPath, usedPath] of [
    ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory.current"],
    [
      "/sys/fs/cgroup/memory/memory.limit_in_bytes",
      "/sys/fs/cgroup/memory/memory.usage_in_bytes",
    ],
  ]) {
    try {
      const limit = Number(read(limitPath, "utf8").trim());
      const used = Number(read(usedPath, "utf8").trim());
      if (Number.isFinite(limit) && Number.isFinite(used) && limit > 0)
        available = Math.min(available, Math.max(0, limit - used));
    } catch {
      /* Missing or unlimited cgroups leave the host memory bound unchanged. */
    }
  }
  return available;
}

export async function preflight({
  root = repository,
  profile = "full",
  command = run,
  memory = availableMemory(),
  nodeVersion = process.versions.node,
  dependencies = dependencyProblems,
  fetchUrl = fetch,
} = {}) {
  if (!["check", "full", "database"].includes(profile))
    throw new Error("Unknown validation profile");
  const failures = [];
  const notes = [];
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const pinnedNode = readFileSync(path.join(root, ".nvmrc"), "utf8")
    .trim()
    .replace(/^v/u, "");
  if (nodeVersion !== pinnedNode)
    failures.push(
      `Node ${pinnedNode} required by .nvmrc (found ${nodeVersion})`,
    );
  const pnpm = command("pnpm", ["--version"]);
  const pinnedPnpm = pkg.packageManager.replace(/^pnpm@/u, "").split("+")[0];
  if (!pnpm.ok || pnpm.output !== pinnedPnpm)
    failures.push(`pnpm ${pinnedPnpm} required by packageManager`);
  failures.push(...dependencies(realpathSync(root)));
  const requiredMemory = (profile === "check" ? 2048 : 4096) * MiB;
  if (memory < requiredMemory)
    failures.push(
      `At least ${requiredMemory / MiB} MiB available memory required; observed ${Math.floor(memory / MiB)} MiB (Darwin pressure warning/critical reports zero headroom). Stop owned idle consumers or use a larger host`,
    );
  if (!command("python3", ["--version"]).ok)
    failures.push("Python 3 is unavailable");
  if (profile === "check" || failures.length)
    return { profile, failures, notes };

  if (profile === "full") {
    const deno = command("deno", ["--version"]);
    if (!deno.ok || !/^deno 2\./u.test(deno.output))
      failures.push("Deno 2 is unavailable; use the CI-compatible toolchain");
    else {
      // The real loader discovers the entire test graph without executing tests or
      // typechecking twice. Frozen lockfiles prevent preflight source mutations.
      const args = [
        "test",
        "--no-run",
        "--no-check",
        "--frozen-lockfile",
        "--config",
        "supabase/functions/deno.json",
        "supabase/functions",
      ];
      if (command("deno", [...args, "--cached-only"], 60_000).ok)
        notes.push("Edge dependency graph available from cache");
      else if (command("deno", args, 60_000).ok)
        notes.push(
          "Edge dependency graph resolved through configured registries",
        );
      else
        failures.push(
          "Edge dependency graph unavailable within 60s (cache/registry/lockfile). Resolve dependencies with the same frozen Deno test --no-run command before retrying the gate",
        );
    }
  }
  if (!command(path.join(root, "node_modules/.bin/supabase"), ["--version"]).ok)
    failures.push("Checkout Supabase CLI unavailable");
  if (!command("docker", ["info", "--format", "{{.ServerVersion}}"], 15_000).ok)
    failures.push("Docker daemon unavailable");
  else {
    // Availability probe only: image selection and ownership remain with the
    // existing disposable runtime. A cached image does not prove a complete set.
    try {
      const response = await fetchUrl("https://public.ecr.aws/v2/", {
        signal: AbortSignal.timeout(10_000),
      });
      if (![200, 401].includes(response.status)) throw new Error("unavailable");
      notes.push(
        "Supabase image registry reachable; exact image availability is checked at owned startup",
      );
    } catch {
      const cached = command("docker", [
        "image",
        "ls",
        "--format",
        "{{.Repository}}",
      ]);
      if (
        cached.ok &&
        cached.output
          .split("\n")
          .some((image) =>
            /^(public\.ecr\.aws\/supabase\/|supabase\/)/u.test(image),
          )
      ) {
        notes.push(
          "Image registry unreachable; cached Supabase images exist, but completeness is unverified until owned startup",
        );
      } else
        failures.push(
          "Supabase image registry unavailable and no cached Supabase images found",
        );
    }
  }
  return { profile, failures, notes };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const profile = process.argv[2] ?? "full";
    process.chdir(repository);
    const result = await preflight({ profile });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.failures.length ? 1 : 0;
  } catch (error) {
    console.error(`Preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}

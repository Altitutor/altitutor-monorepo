import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  availableMemory,
  dependencyProblems,
  inside,
  preflight,
  run,
} from "./validation-preflight.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "validation-preflight-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ packageManager: "pnpm@11.28.9" }),
  );
  writeFileSync(path.join(root, ".nvmrc"), "24.22.2\n");
  for (const entry of [
    "apps",
    "packages",
    "node_modules/.bin",
    ...["turbo", "eslint", "typescript", "supabase"].map(
      (name) => `node_modules/${name}`,
    ),
  ])
    mkdirSync(path.join(root, entry), { recursive: true });
  return root;
}

function options(t, override = {}) {
  const calls = [];
  return {
    calls,
    root: fixture(t),
    nodeVersion: "24.22.2",
    memory: 8 * 1024 ** 3,
    command(command, args) {
      calls.push([command, args]);
      return {
        ok: true,
        output:
          command === "pnpm"
            ? "11.28.9"
            : command === "deno" && args[0] === "--version"
              ? "deno 2.5.4"
              : "",
      };
    },
    fetchUrl: async () => ({ status: 200 }),
    ...override,
  };
}

test("rejects shared dependency directories and .bin before expensive prerequisites", async (t) => {
  const o = options(t);
  const outside = fixture(t);
  rmSync(path.join(o.root, "node_modules/.bin"), { recursive: true });
  symlinkSync(
    path.join(outside, "node_modules/.bin"),
    path.join(o.root, "node_modules/.bin"),
  );
  const result = await preflight(o);
  assert.match(result.failures.join("\n"), /\.bin resolves outside/u);
  assert.equal(
    o.calls.some(([command]) => command === "deno" || command === "docker"),
    false,
  );
});

test("allows local pnpm virtual-store links but rejects another checkout's package", (t) => {
  const root = fixture(t);
  const outside = fixture(t);
  mkdirSync(path.join(root, "node_modules/.pnpm/tool"), { recursive: true });
  rmSync(path.join(root, "node_modules/turbo"), { recursive: true });
  symlinkSync(
    path.join(root, "node_modules/.pnpm/tool"),
    path.join(root, "node_modules/turbo"),
  );
  assert.deepEqual(dependencyProblems(root), []);
  rmSync(path.join(root, "node_modules/turbo"));
  symlinkSync(
    path.join(outside, "node_modules/turbo"),
    path.join(root, "node_modules/turbo"),
  );
  assert.match(
    dependencyProblems(root).join("\n"),
    /turbo must resolve within/u,
  );
  assert.equal(inside(root, `${root}-other/node_modules`), false);
});

test("hoisted workspaces may omit local node_modules while root install remains required", (t) => {
  const root = fixture(t);
  mkdirSync(path.join(root, "packages/hoisted"));
  writeFileSync(path.join(root, "packages/hoisted/package.json"), "{}");
  assert.deepEqual(dependencyProblems(root), []);
  rmSync(path.join(root, "node_modules"), { recursive: true });
  assert.match(
    dependencyProblems(root).join("\n"),
    /Root dependencies missing/u,
  );
});

test("a symlinked checkout root accepts its own dependencies and still rejects foreign targets", (t) => {
  const root = fixture(t);
  const outside = fixture(t);
  const alias = path.join(outside, "checkout-alias");
  symlinkSync(root, alias);
  assert.deepEqual(dependencyProblems(alias), []);
  rmSync(path.join(root, "node_modules/turbo"), { recursive: true });
  symlinkSync(
    path.join(outside, "node_modules/turbo"),
    path.join(root, "node_modules/turbo"),
  );
  assert.match(
    dependencyProblems(alias).join("\n"),
    /turbo must resolve within/u,
  );
});

test("reports pinned version and memory failures without starting containers", async (t) => {
  const result = await preflight(
    options(t, {
      nodeVersion: "24.0.0",
      memory: 512 * 1024 ** 2,
      command: () => ({ ok: true, output: "11.25.0" }),
    }),
  );
  assert.equal(result.failures.length, 3);
  assert.match(result.failures.join("\n"), /Node 24\.22\.2/u);
  assert.match(result.failures.join("\n"), /pnpm 11\.28\.9/u);
  assert.match(result.failures.join("\n"), /available memory/u);
});

test("cgroup headroom bounds host memory; non-Linux and unlimited groups retain host value", () => {
  assert.equal(
    availableMemory({
      platform: "linux",
      hostFree: 8000,
      read: (p) =>
        p.endsWith("memory.max")
          ? "3000"
          : p.endsWith("memory.current")
            ? "2500"
            : "max",
    }),
    500,
  );
  assert.equal(
    availableMemory({
      platform: "linux",
      hostFree: 8000,
      read: () => {
        throw new Error("absent");
      },
    }),
    8000,
  );
  assert.equal(
    availableMemory({ platform: "linux", hostFree: 8000, read: () => "max" }),
    8000,
  );
});

// Observed on the local 64 GiB Mac when the old preflight rejected 2367 MiB
// of unused RAM. These are vm_stat counters from that same diagnostic snapshot.
const macSnapshot = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                              104564.
Pages active:                           1627126.
Pages inactive:                         1618896.
Pages speculative:                         7478.
Pages wired down:                        362531.
Pages purgeable:                         138353.
File-backed pages:                       507410.
`;

function macMemory(overrides = {}) {
  return {
    platform: "darwin",
    hostFree: 2367 * 1024 ** 2,
    hostTotal: 68719476736,
    command: (name) => ({
      ok: true,
      output: name === "/usr/bin/vm_stat" ? macSnapshot : "1",
    }),
    read: () => {
      throw new Error("Darwin must not inspect Linux cgroups");
    },
    ...overrides,
  };
}

test("Darwin observed cache-heavy host passes without adding overlapping counters", () => {
  assert.equal(availableMemory(macMemory()), (104564 + 507410) * 16384);
  assert.ok(availableMemory(macMemory()) >= 4096 * 1024 ** 2);
  const inflatedOverlaps = macSnapshot
    .replace("7478.", "999999.")
    .replace("138353.", "999999.");
  assert.equal(
    availableMemory(
      macMemory({
        command: (name) => ({
          ok: true,
          output: name === "/usr/bin/vm_stat" ? inflatedOverlaps : "1",
        }),
      }),
    ),
    (104564 + 507410) * 16384,
  );
});

test("Darwin low headroom and pressure warnings still refuse a full gate", () => {
  const small = macSnapshot
    .replace("104564.", "100.")
    .replace("507410.", "200.");
  assert.equal(
    availableMemory(
      macMemory({
        command: (name) => ({
          ok: true,
          output: name === "/usr/bin/vm_stat" ? small : "1",
        }),
      }),
    ),
    300 * 16384,
  );
  for (const pressure of ["2", "4"]) {
    assert.equal(
      availableMemory(
        macMemory({
          command: (name) => ({
            ok: true,
            output: name === "/usr/bin/vm_stat" ? macSnapshot : pressure,
          }),
        }),
      ),
      0,
    );
  }
});

test("Darwin malformed or unavailable diagnostics fall back to unused RAM", () => {
  const fallback = 2367 * 1024 ** 2;
  for (const bad of [
    "",
    macSnapshot.replace("16384 bytes", "0 bytes"),
    macSnapshot.replace("507410.", "-2."),
    macSnapshot.replace("507410.", "9007199254740992."),
    `${macSnapshot}Pages free: 1.\n`,
  ]) {
    assert.equal(
      availableMemory(
        macMemory({
          command: (name) => ({
            ok: true,
            output: name === "/usr/bin/vm_stat" ? bad : "1",
          }),
        }),
      ),
      fallback,
    );
  }
  assert.equal(
    availableMemory(macMemory({ command: () => ({ ok: false, output: "" }) })),
    fallback,
  );
  assert.equal(
    availableMemory(
      macMemory({
        command: (name) => ({
          ok: true,
          output: name === "/usr/bin/vm_stat" ? macSnapshot : "unknown",
        }),
      }),
    ),
    fallback,
  );
});

test("Darwin credit is capped by inactive pages and total physical RAM", () => {
  const inactiveBound = macSnapshot.replace("1618896.", "20.");
  assert.equal(
    availableMemory(
      macMemory({
        command: (name) => ({
          ok: true,
          output: name === "/usr/bin/vm_stat" ? inactiveBound : "1",
        }),
      }),
    ),
    (104564 + 20) * 16384,
  );
  assert.equal(availableMemory(macMemory({ hostTotal: 1024 ** 3 })), 1024 ** 3);
});

test("Darwin diagnostics are bounded, absolute-path read-only queries", () => {
  const calls = [];
  availableMemory(
    macMemory({
      command: (name, args, timeout) => {
        calls.push({ name, args, timeout });
        return {
          ok: true,
          output: name === "/usr/bin/vm_stat" ? macSnapshot : "1",
        };
      },
    }),
  );
  assert.deepEqual(calls, [
    {
      name: "/usr/sbin/sysctl",
      args: ["-n", "kern.memorystatus_vm_pressure_level"],
      timeout: 2000,
    },
    { name: "/usr/bin/vm_stat", args: [], timeout: 2000 },
  ]);
});

test("check profile needs no Docker or Deno and rejects unknown profiles", async (t) => {
  const o = options(t, { profile: "check" });
  assert.deepEqual((await preflight(o)).failures, []);
  assert.equal(
    o.calls.some(([command]) => command === "deno" || command === "docker"),
    false,
  );
  await assert.rejects(
    preflight({ ...o, profile: "skip-all" }),
    /Unknown validation profile/u,
  );
});

test("complete cached Edge graph works offline without online dependency resolution", async (t) => {
  const o = options(t, {
    fetchUrl: async () => {
      throw new Error("offline");
    },
  });
  const base = o.command;
  o.command = (command, args) =>
    args[0] === "image"
      ? { ok: true, output: "public.ecr.aws/supabase/postgres" }
      : base(command, args);
  const result = await preflight(o);
  assert.deepEqual(result.failures, []);
  const loads = o.calls.filter(
    ([command, args]) => command === "deno" && args[0] === "test",
  );
  assert.equal(loads.length, 1);
  assert.ok(loads[0][1].includes("--cached-only"));
  assert.ok(loads[0][1].includes("--frozen-lockfile"));
  assert.ok(loads[0][1].includes("--no-run"));
  assert.match(result.notes.join("\n"), /completeness is unverified/u);
});

test("missing Edge cache and denied registry fail before expensive gate stages", async (t) => {
  const o = options(t);
  const base = o.command;
  o.command = (command, args) =>
    command === "deno" && args[0] === "test"
      ? { ok: false, output: "" }
      : base(command, args);
  const result = await preflight(o);
  assert.match(
    result.failures.join("\n"),
    /Edge dependency graph unavailable/u,
  );
});

test("Docker unavailability and registry denial without cache are actionable failures", async (t) => {
  const o = options(t, { fetchUrl: async () => ({ status: 403 }) });
  const base = o.command;
  o.command = (command, args) =>
    args[0] === "image" ? { ok: true, output: "" } : base(command, args);
  assert.match(
    (await preflight(o)).failures.join("\n"),
    /no cached Supabase images/u,
  );
  o.command = (command, args) =>
    command === "docker" ? { ok: false, output: "" } : base(command, args);
  assert.match(
    (await preflight(o)).failures.join("\n"),
    /Docker daemon unavailable/u,
  );
});

test("subprocess timeout returns a failure rather than hanging the preflight", () => {
  assert.equal(
    run(process.execPath, ["-e", "setInterval(()=>{},1000)"], 30).ok,
    false,
  );
});

import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export function assertSameInventory(unit, coverage) {
  if (
    !Array.isArray(unit) ||
    !Array.isArray(coverage) ||
    unit.length === 0 ||
    unit.some((name) => typeof name !== "string") ||
    coverage.some((name) => typeof name !== "string")
  ) {
    throw new Error("UCAT test discovery must return nonempty filename arrays");
  }
  const expected = [...new Set(unit)].sort();
  const actual = [...new Set(coverage)].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      "UCAT coverage and unit test inventories differ; restore equivalent discovery before running the full gate",
    );
  }
  return expected.length;
}

export function verifyInventory(command = spawnSync) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const discover = (script) => {
    // Use the real package scripts: a future filter added to either script must
    // be detected, rather than comparing two hardcoded equivalent Jest commands.
    const result = command(
      "pnpm",
      [
        "--silent",
        "--filter",
        "ucat-web",
        script,
        "--listTests",
        "--json",
        "--runInBand",
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (result.error || result.status !== 0)
      throw new Error(`UCAT ${script} discovery failed`);
    return JSON.parse(result.stdout);
  };
  return assertSameInventory(discover("test"), discover("test:coverage"));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(
      `UCAT unit/coverage inventories match: ${verifyInventory()} files`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

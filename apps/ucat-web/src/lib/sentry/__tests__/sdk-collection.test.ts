/** @jest-environment node */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const execute = promisify(execFile);

async function collect(
  env: Record<string, string | undefined> = {},
  app = "ucat-web",
) {
  const appRoot = join(process.cwd(), "..", app);
  const temporary = await mkdtemp(join(tmpdir(), "sentry-collection-"));
  let stdout: string;
  try {
    const appConfig = JSON.parse(
      await readFile(join(appRoot, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    const paths = Object.fromEntries(
      Object.entries(appConfig.compilerOptions.paths).map(([name, targets]) => [
        name,
        targets.map((target) => resolve(appRoot, target)),
      ]),
    );
    // Like Jest's workspace mapping, the child must work before any package build.
    paths["@altitutor/ucat-response-contract"] = [
      resolve(appRoot, "../../packages/ucat-response-contract/src/index.ts"),
    ];
    const config = join(temporary, "tsconfig.json");
    await writeFile(
      config,
      JSON.stringify({
        extends: join(appRoot, "tsconfig.json"),
        compilerOptions: { paths },
      }),
    );
    ({ stdout } = await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        join(__dirname, "../test-fixtures/collection-child.ts"),
      ],
      {
        cwd: appRoot,
        env: {
          ...process.env,
          NODE_ENV: "production",
          VERCEL_ENV: "production",
          VERCEL_TARGET_ENV: "",
          CI: "",
          SENTRY_DISABLED: "",
          SENTRY_TEST_OPT_IN: "",
          SENTRY_ENVIRONMENT: "",
          ...env,
          TSX_TSCONFIG_PATH: config,
        },
        timeout: 15000,
      },
    ));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  const { reports } = JSON.parse(stdout.trim().split("\n").at(-1)!) as {
    reports: {
      type: string;
      payload: {
        transaction?: string;
        tags?: Record<string, string>;
        user?: { id?: string };
        request?: { headers?: Record<string, string> };
      };
    }[];
  };
  return reports;
}
it.each(["admin-web", "student-web", "tutor-web", "marketing-web", "ucat-web"])(
  "%s sends an unexpected request failure once while preserving safe context and withholding credentials",
  async (app) => {
    const reports = await collect({}, app);
    const events = reports.filter((report) => report.type === "event");
    expect(events).toHaveLength(1);
    expect(events[0]?.payload.user?.id).toBe("fixture-student");
    expect(events[0]?.payload.request?.headers?.["x-study-mode"]).toBe(
      "practice",
    );
    const serialized = JSON.stringify(events);
    for (const secret of [
      "private-fixture-authorization",
      "private-fixture-cookie",
      "private-fixture-password",
      "private-fixture-token",
      "198.51.100.9",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  },
  20000,
);

it.each([
  { VERCEL_ENV: "development" },
  { VERCEL_ENV: "preview" },
  { VERCEL_TARGET_ENV: "staging" },
  { CI: "true", SENTRY_TEST_OPT_IN: "true" },
  { SENTRY_DISABLED: "true", SENTRY_TEST_OPT_IN: "true" },
])(
  "sends no automatic reports when collection is disabled by %p",
  async (env) => {
    const reports = await collect(env);
    expect(reports).toEqual([]);
  },
  20000,
);

it("keeps sampled study transactions and their tags while excluding native auth bridge transactions", async () => {
  const reports = await collect();
  const study = reports.filter(
    (report) =>
      report.type === "transaction" &&
      report.payload.transaction === "fixture safe study trace",
  );
  expect(study).toHaveLength(1);
  expect(study[0]?.payload.tags?.["fixture.study"]).toBe("practice");
  expect(JSON.stringify(reports)).not.toContain("private-fixture-ticket");
}, 20000);

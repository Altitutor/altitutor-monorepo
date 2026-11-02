import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmailRuntimeConfig,
  deployRuntimeSecrets,
  serializeRuntimeSecrets,
} from "./lib/runtime-secrets.mjs";
const fixture = {
  EMAIL_M365_TENANT_ID: "fixture-tenant",
  EMAIL_M365_CLIENT_ID: "fixture-client",
  EMAIL_M365_CLIENT_SECRET: "fixture-private-value",
  CRON_SECRET: "fixture-cron-value",
  EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS: "matt@altitutor.com",
};
test("development mail credentials reach only admin Preview and the development Edge project", async () => {
  const plan = createEmailRuntimeConfig("development", fixture);
  const requests = [];
  const output = [];
  let edge;
  await deployRuntimeSecrets(plan, {
    vercelToken: "fixture-deploy-token",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body) });
      return Response.json({ created: { value: "fixture-private-value" } });
    },
    setSupabaseSecrets: async (project, values) => {
      edge = { project, values };
    },
    log: (line) => output.push(line),
  });
  assert.equal(plan.mailbox, "admin@development.altitutor.com");
  assert.equal(edge.project, "ysfslbdcacpbemodkwtl");
  assert.equal(edge.values.EMAIL_ENVIRONMENT, "development");
  assert.equal(edge.values.EMAIL_M365_CLIENT_SECRET, "fixture-private-value");
  assert.ok(!("CRON_SECRET" in edge.values));
  assert.ok(
    requests.every(
      (r) =>
        r.url.includes("/projects/altitutor-admin-web/env?") &&
        r.body.target.length === 1 &&
        r.body.target[0] === "preview",
    ),
  );
  assert.ok(requests.some((r) => r.body.key === "CRON_SECRET"));
  assert.ok(!output.join("\n").includes("fixture-private-value"));
  assert.ok(!output.join("\n").includes("fixture-cron-value"));
});
test("production routing cannot be selected through a development file or a wrong project", () => {
  assert.throws(
    () =>
      createEmailRuntimeConfig("development", {
        ...fixture,
        SUPABASE_PROJECT_REF: "mzgunxjfgvcyivcyqimn",
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      createEmailRuntimeConfig("development", {
        ...fixture,
        EMAIL_ENVIRONMENT: "production",
      }),
    /conflicts/,
  );
  const plan = createEmailRuntimeConfig("production", fixture);
  assert.equal(plan.project, "mzgunxjfgvcyivcyqimn");
  assert.equal(plan.mailbox, "admin@altitutor.com");
  assert.equal(plan.vercelTarget, "production");
  assert.ok(!("EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS" in plan.edge));
});
test("missing dedicated credentials and an empty development recipient list fail before deployment", () => {
  assert.throws(
    () =>
      createEmailRuntimeConfig("development", {
        ...fixture,
        EMAIL_M365_CLIENT_SECRET: "",
      }),
    /EMAIL_M365_CLIENT_SECRET/,
  );
  assert.throws(
    () =>
      createEmailRuntimeConfig("development", {
        ...fixture,
        EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS: "",
      }),
    /test recipients/,
  );
  assert.throws(
    () =>
      createEmailRuntimeConfig("development", {
        ...fixture,
        EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS: "customer@example.test",
      }),
    /Altitutor/,
  );
});

test("CLI env transport preserves literal dollar expressions and quotes", () => {
  assert.equal(
    serializeRuntimeSecrets({
      EMAIL_M365_CLIENT_SECRET: 'fixture$HOME${OTHER}"tail',
    }),
    'EMAIL_M365_CLIENT_SECRET="fixture\\$HOME\\${OTHER}\\"tail"\n',
  );
});

// Exercise both normal deployment entry points, including their existing shell
// parser, with isolated files, fake provider endpoints and no live credentials.
test("normal Vercel and Supabase scripts deploy distinct email values without shared fallback", async () => {
  const {
    mkdtempSync,
    mkdirSync,
    copyFileSync,
    writeFileSync,
    readFileSync,
    rmSync,
  } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { spawnSync } = await import("node:child_process");
  const root = mkdtempSync(join(tmpdir(), "runtime-deployment-contract-"));
  try {
    const scripts = join(root, "secrets/scripts"),
      bin = join(root, "bin"),
      log = join(root, "requests.jsonl");
    mkdirSync(join(scripts, "lib"), { recursive: true });
    mkdirSync(bin);
    for (const name of [
      "common.sh",
      "deploy-vercel.sh",
      "deploy-supabase.sh",
      "lib/runtime-secrets.mjs",
    ])
      copyFileSync(
        fileURLToPath(new URL(name, import.meta.url)),
        join(scripts, name),
      );
    for (const environment of ["development", "production"]) {
      const project =
        environment === "development"
          ? "ysfslbdcacpbemodkwtl"
          : "mzgunxjfgvcyivcyqimn";
      writeFileSync(
        join(root, `secrets/.env.${environment}`),
        `SUPABASE_PROJECT_REF=${project}\nEMAIL_M365_TENANT_ID=fixture-tenant\nEMAIL_M365_CLIENT_ID=${environment}-client\nEMAIL_M365_CLIENT_SECRET="${environment}$HOME-Value"\nEMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS=matt@altitutor.com\nCRON_SECRET=fixture-cron\n`,
      );
    }
    writeFileSync(
      join(root, "secrets/.env.shared"),
      "VERCEL_TOKEN=fixture-token\nEMAIL_M365_CLIENT_SECRET=must-not-deploy\n",
    );
    for (const name of ["vercel"])
      writeFileSync(join(bin, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(
      join(bin, "jq"),
      `#!/usr/bin/env node
let input='';for await(const part of process.stdin) input+=part;console.log(JSON.parse(input).id || '');
`,
      { mode: 0o755 },
    );
    // Shell Vercel writes unrelated normal settings; Node's fetch handles the
    // literal credential payloads. Both are redirected to this fixture log.
    writeFileSync(
      join(bin, "curl"),
      `#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2),url=args.at(-1);
if(args.includes('-X')){fs.appendFileSync(process.env.TEST_REQUEST_LOG,JSON.stringify({platform:'vercel',url,body:JSON.parse(args[args.indexOf('-d')+1])})+'\\n');console.log('ENVELOPE_CREATED');}
else console.log(JSON.stringify({id:url.split('/projects/')[1].split('?')[0]}));
`,
      { mode: 0o755 },
    );
    // Existing shell detection expects the provider's created envelope.
    const curl = join(bin, "curl");
    writeFileSync(
      curl,
      readFileSync(curl, "utf8").replace(
        "console.log('ENVELOPE_CREATED')",
        "console.log(JSON.stringify({created:true}))",
      ),
    );
    writeFileSync(
      join(bin, "supabase"),
      `#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2),file=args[args.indexOf('--env-file')+1];
const contents=fs.readFileSync(file,'utf8');
fs.appendFileSync(process.env.TEST_REQUEST_LOG,JSON.stringify({platform:'supabase',project:args[args.indexOf('--project-ref')+1],contents,mode:fs.statSync(file).mode&0o777})+'\\n');
`,
      { mode: 0o755 },
    );
    const preload = join(root, "provider.mjs");
    writeFileSync(
      preload,
      `import fs from 'node:fs';globalThis.fetch=async(url,init)=>{fs.appendFileSync(process.env.TEST_REQUEST_LOG,JSON.stringify({platform:'vercel',url:String(url),body:JSON.parse(init.body)})+'\\n');return Response.json({created:true});};`,
    );
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      VERCEL_TOKEN: "fixture-token",
      NODE_OPTIONS: `--import=${preload}`,
      TEST_REQUEST_LOG: log,
    };
    for (const name of ["deploy-vercel.sh", "deploy-supabase.sh"]) {
      const result = spawnSync("bash", [join(scripts, name)], {
        env,
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.ok(!(result.stdout + result.stderr).includes("Value"));
      assert.ok(!(result.stdout + result.stderr).includes("must-not-deploy"));
    }
    const requests = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    const mail = requests.filter(
      (r) => r.body?.key === "EMAIL_M365_CLIENT_SECRET",
    );
    assert.deepEqual(
      mail.map((r) => [r.body.target[0], r.body.value]),
      [
        ["preview", "development$HOME-Value"],
        ["production", "production$HOME-Value"],
      ],
    );
    assert.ok(mail.every((r) => r.url.includes("altitutor-admin-web/env?")));
    const edge = requests.filter(
      (r) =>
        r.platform === "supabase" &&
        r.contents.includes("EMAIL_M365_CLIENT_SECRET"),
    );
    assert.deepEqual(
      edge.map((r) => r.project),
      ["ysfslbdcacpbemodkwtl", "mzgunxjfgvcyivcyqimn"],
    );
    assert.ok(edge.every((r) => r.mode === 0o600));
    assert.ok(
      !requests.some((r) => JSON.stringify(r).includes("must-not-deploy")),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("deploy-all calls the normal platforms and fails when any child fails", async () => {
  const fs = await import("node:fs"),
    { tmpdir } = await import("node:os"),
    { join } = await import("node:path"),
    { spawnSync } = await import("node:child_process"),
    { fileURLToPath } = await import("node:url");
  const root = fs.mkdtempSync(join(tmpdir(), "deploy-all-contract-"));
  try {
    for (const name of ["deploy-all.sh", "common.sh"])
      fs.copyFileSync(
        fileURLToPath(new URL(name, import.meta.url)),
        join(root, name),
      );
    const log = join(root, "platforms");
    for (const platform of ["github", "vercel", "supabase", "eas"])
      fs.writeFileSync(
        join(root, `deploy-${platform}.sh`),
        `#!/bin/sh\necho ${platform} >> "$TEST_PLATFORM_LOG"\n${platform === "supabase" ? "exit 1" : "exit 0"}\n`,
      );
    const result = spawnSync("bash", [join(root, "deploy-all.sh")], {
      encoding: "utf8",
      env: { ...process.env, TEST_PLATFORM_LOG: log },
    });
    assert.equal(result.status, 1);
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), [
      "github",
      "vercel",
      "supabase",
      "eas",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

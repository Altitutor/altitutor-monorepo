import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMailboxDeployment,
  deployMailbox,
  serializeMailboxSecrets,
} from "./deploy-mailbox.mjs";
const fixture = {
  EMAIL_M365_TENANT_ID: "fixture-tenant",
  EMAIL_M365_CLIENT_ID: "fixture-client",
  EMAIL_M365_CLIENT_SECRET: "fixture-private-value",
  CRON_SECRET: "fixture-cron-value",
  EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS: "matt@altitutor.com",
};
test("development mail credentials reach only admin Preview and the development Edge project", async () => {
  const plan = createMailboxDeployment("development", fixture);
  const requests = [];
  const output = [];
  let edge;
  await deployMailbox(plan, {
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
      createMailboxDeployment("development", {
        ...fixture,
        SUPABASE_PROJECT_REF: "mzgunxjfgvcyivcyqimn",
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      createMailboxDeployment("development", {
        ...fixture,
        EMAIL_ENVIRONMENT: "production",
      }),
    /conflicts/,
  );
  const plan = createMailboxDeployment("production", fixture);
  assert.equal(plan.project, "mzgunxjfgvcyivcyqimn");
  assert.equal(plan.mailbox, "admin@altitutor.com");
  assert.equal(plan.vercelTarget, "production");
  assert.ok(!("EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS" in plan.edge));
});
test("missing dedicated credentials and an empty development recipient list fail before deployment", () => {
  assert.throws(
    () =>
      createMailboxDeployment("development", {
        ...fixture,
        EMAIL_M365_CLIENT_SECRET: "",
      }),
    /EMAIL_M365_CLIENT_SECRET/,
  );
  assert.throws(
    () =>
      createMailboxDeployment("development", {
        ...fixture,
        EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS: "",
      }),
    /test recipients/,
  );
  assert.throws(
    () =>
      createMailboxDeployment("development", {
        ...fixture,
        EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS: "customer@example.test",
      }),
    /Altitutor/,
  );
});

test("CLI env transport preserves literal dollar expressions and quotes", () => {
  assert.equal(
    serializeMailboxSecrets({
      EMAIL_M365_CLIENT_SECRET: 'fixture$HOME${OTHER}"tail',
    }),
    'EMAIL_M365_CLIENT_SECRET="fixture\\$HOME\\${OTHER}\\"tail"\n',
  );
});

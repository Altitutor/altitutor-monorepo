import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
const team = "team_1E1lzurM2oIC9oDKmQDdk7Bz";
const targets = {
  development: {
    project: "ysfslbdcacpbemodkwtl",
    mailbox: "admin@development.altitutor.com",
    vercelTarget: "preview",
  },
  production: {
    project: "mzgunxjfgvcyivcyqimn",
    mailbox: "admin@altitutor.com",
    vercelTarget: "production",
  },
};
const credentialKeys = [
  "EMAIL_M365_TENANT_ID",
  "EMAIL_M365_CLIENT_ID",
  "EMAIL_M365_CLIENT_SECRET",
];

/** Only values from the selected environment file are accepted; shared mail credentials are never merged. */
export function createEmailRuntimeConfig(environment, env) {
  const target = targets[environment];
  if (!Object.hasOwn(targets, environment))
    throw new Error("Choose exactly --environment development or production.");
  for (const key of ["SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_REF"])
    if (env[key] && env[key] !== target.project)
      throw new Error(
        `${key} does not match the selected mailbox environment.`,
      );
  if (env.EMAIL_ENVIRONMENT && env.EMAIL_ENVIRONMENT !== environment)
    throw new Error(
      "EMAIL_ENVIRONMENT conflicts with the selected environment.",
    );
  for (const key of credentialKeys)
    if (!env[key]?.trim() || /[\x00-\x1f\x7f]/.test(env[key]))
      throw new Error(`Set ${key} in the selected environment file.`);
  if (env.CRON_SECRET && /[\x00-\x1f\x7f]/.test(env.CRON_SECRET))
    throw new Error("CRON_SECRET must not contain control characters.");
  const edge = Object.fromEntries(credentialKeys.map((key) => [key, env[key]]));
  edge.EMAIL_ENVIRONMENT = environment;
  if (environment === "development") {
    const recipients = (env.EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (!recipients.length)
      throw new Error("Configure explicit development test recipients.");
    if (recipients.some((v) => !/^[^\s<>@]+@altitutor\.com$/.test(v)))
      throw new Error(
        "Development test recipients must be individual Altitutor staff addresses.",
      );
    edge.EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS = recipients.join(",");
  }
  return {
    ...target,
    environment,
    edge,
    web: {
      ...edge,
      ...(env.CRON_SECRET ? { CRON_SECRET: env.CRON_SECRET } : {}),
    },
  };
}

export async function deployRuntimeSecrets(
  plan,
  {
    vercelToken,
    fetchImpl = fetch,
    setSupabaseSecrets,
    platform = "both",
    log = console.log,
  },
) {
  if (!["vercel", "supabase", "both"].includes(platform))
    throw new Error("Unknown runtime deployment platform.");
  if (platform !== "supabase") {
    if (!vercelToken)
      throw new Error("VERCEL_TOKEN is required in the shell or .env.shared.");
    for (const [key, value] of Object.entries(plan.web)) {
      let response;
      try {
        response = await fetchImpl(
          `https://api.vercel.com/v10/projects/altitutor-admin-web/env?upsert=true&teamId=${team}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              key,
              value,
              type: "encrypted",
              target: [plan.vercelTarget],
            }),
            signal: AbortSignal.timeout(30_000),
          },
        );
      } catch {
        throw new Error(
          `Vercel update for ${key} did not complete. Rerun this idempotent deployment after checking connectivity.`,
        );
      }
      if (!response.ok)
        throw new Error(
          `Vercel update for ${key} failed (HTTP ${response.status}).`,
        );
      const result = await response.json().catch(() => null);
      if (!result || result.error || result.failed?.length)
        throw new Error(`Vercel did not confirm ${key}.`);
      log(`Updated admin-web ${plan.vercelTarget}: ${key}`);
    }
  }
  if (platform !== "vercel") {
    await setSupabaseSecrets(plan.project, plan.edge);
    log(`Updated ${plan.environment} Supabase runtime secrets.`);
  }
  log(
    "Redeploy admin-web to load its new values. This script does not deploy code, migrate databases or send email.",
  );
}

// Supabase's dotenv reader expands dollar expressions inside double quotes.
// Escape them after JSON quoting so a secret is always transported literally.
export function serializeRuntimeSecrets(values) {
  return (
    Object.entries(values)
      .map(
        ([key, value]) =>
          `${key}=${JSON.stringify(value).replaceAll("$", "\\$")}`,
      )
      .join("\n") + "\n"
  );
}

export function edgeSecretSetter(accessToken) {
  return async (project, values) => {
    const directory = mkdtempSync(join(tmpdir(), "altitutor-mail-secrets-"));
    try {
      const file = join(directory, "mailbox.env");
      writeFileSync(file, serializeRuntimeSecrets(values), { mode: 0o600 });
      const result = spawnSync(
        "supabase",
        ["secrets", "set", "--project-ref", project, "--env-file", file],
        {
          env: {
            ...process.env,
            ...(accessToken ? { SUPABASE_ACCESS_TOKEN: accessToken } : {}),
          },
          timeout: 60_000,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      // CLI/provider output can contain sensitive values; never forward it.
      if (result.status !== 0)
        throw new Error(
          "Supabase mailbox secret deployment failed. Check CLI authentication and project permissions, then rerun.",
        );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

export function readEnvironmentFile(file) {
  try {
    return parseEnv(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`Could not read environment file: ${file}`);
  }
}

/** Read deployment authentication privately; never use shared mailbox credentials. */
export function deploymentAuthentication(directory) {
  const sharedFile = join(directory, ".env.shared");
  const shared = existsSync(sharedFile) ? readEnvironmentFile(sharedFile) : {};
  let vercelToken = process.env.VERCEL_TOKEN || shared.VERCEL_TOKEN;
  if (!vercelToken) {
    for (const file of [
      join(homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
      join(homedir(), ".vercel/auth.json"),
    ]) {
      if (!existsSync(file)) continue;
      try {
        vercelToken = JSON.parse(readFileSync(file, "utf8")).token;
      } catch {
        /* Try the next supported login location. */
      }
      if (vercelToken) break;
    }
  }
  return {
    vercelToken,
    setSupabaseSecrets: edgeSecretSetter(
      process.env.SUPABASE_ACCESS_TOKEN || shared.SUPABASE_ACCESS_TOKEN,
    ),
  };
}

/** Internal adapter used by the existing Vercel and Supabase deployment scripts. */
export async function deployEmailEnvironment({
  directory,
  environment,
  platform,
}) {
  const file = join(directory, `.env.${environment}`);
  const env = readEnvironmentFile(file);
  if (!credentialKeys.some((key) => env[key]?.trim())) {
    console.log(
      `Skipping unconfigured ${environment} Microsoft email settings.`,
    );
    return;
  }
  const plan = createEmailRuntimeConfig(environment, env);
  await deployRuntimeSecrets(plan, {
    ...deploymentAuthentication(directory),
    platform,
  });
}

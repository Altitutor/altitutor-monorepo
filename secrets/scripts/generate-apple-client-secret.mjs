#!/usr/bin/env node

import { createPrivateKey, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SECRETS_DIR = resolve(SCRIPT_DIR, "..");
const VALID_ENVIRONMENTS = new Set(["development", "production"]);
const SIX_MONTHS_IN_SECONDS = 60 * 60 * 24 * 180;

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(`Usage:
  node secrets/scripts/generate-apple-client-secret.mjs \\
    --private-key /secure/path/AuthKey_KEYID.p8 \\
    --key-id KEYID \\
    --team-id TEAMID \\
    --client-id com.example.web \\
    --env development --env production`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = { environments: [] };

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value) usage(`Invalid argument near ${flag ?? "end of input"}`);

    switch (flag) {
      case "--private-key":
        parsed.privateKeyPath = value;
        break;
      case "--key-id":
        parsed.keyId = value;
        break;
      case "--team-id":
        parsed.teamId = value;
        break;
      case "--client-id":
        parsed.clientId = value;
        break;
      case "--env":
        parsed.environments.push(value);
        break;
      default:
        usage(`Unknown argument ${flag}`);
    }
  }

  for (const key of ["privateKeyPath", "keyId", "teamId", "clientId"]) {
    if (!parsed[key]) usage(`Missing --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (parsed.environments.length === 0) usage("Specify at least one --env");
  for (const environment of parsed.environments) {
    if (!VALID_ENVIRONMENTS.has(environment)) usage(`Unsupported environment: ${environment}`);
  }

  return parsed;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createClientSecret({ privateKey, keyId, teamId, clientId }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SIX_MONTHS_IN_SECONDS;
  const header = encodeJson({ alg: "ES256", kid: keyId, typ: "JWT" });
  const claims = encodeJson({
    iss: teamId,
    iat: issuedAt,
    exp: expiresAt,
    aud: "https://appleid.apple.com",
    sub: clientId,
  });
  const signingInput = `${header}.${claims}`;
  const signature = sign(null, Buffer.from(signingInput), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return { token: `${signingInput}.${signature}`, expiresAt };
}

function setEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const matcher = new RegExp(`^${key}=.*$`, "m");
  if (matcher.test(contents)) return contents.replace(matcher, line);
  return `${contents.replace(/\n*$/, "")}\n${line}\n`;
}

async function updateEnvironment(environment, clientId, token) {
  const envPath = resolve(SECRETS_DIR, `.env.${environment}`);
  let contents = await readFile(envPath, "utf8");
  contents = setEnvValue(contents, "AUTH_APPLE_ENABLED", "true");
  contents = setEnvValue(contents, "SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID", clientId);
  contents = setEnvValue(contents, "SUPABASE_AUTH_EXTERNAL_APPLE_SECRET", token);
  await writeFile(envPath, contents, { encoding: "utf8", mode: 0o600 });
}

const options = parseArgs(process.argv.slice(2));
const privateKey = await readFile(resolve(options.privateKeyPath), "utf8");
const { token, expiresAt } = createClientSecret({ ...options, privateKey });

for (const environment of [...new Set(options.environments)]) {
  await updateEnvironment(environment, options.clientId, token);
}

console.log(
  `Updated ${[...new Set(options.environments)].join(", ")} Apple credentials; client secret expires ${new Date(expiresAt * 1000).toISOString()}.`,
);

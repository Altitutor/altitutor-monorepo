import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrations = new URL("../migrations/", import.meta.url);

function latestDefinition(pattern) {
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort().reverse()) {
    const sql = readFileSync(new URL(file, migrations), "utf8");
    if (pattern.test(sql)) return sql;
  }
  assert.fail(`Could not find the active SQL definition for ${pattern}`);
}

function expiryEventTypes(sql) {
  const list = sql.match(/\bevent_type\s+IN\s*\(((?:\s*'[a-z_.]+'\s*,?)+)\)/iu)?.[1];
  assert.ok(list, "The Stripe expiry predicate must explicitly allowlist event types");
  return [...list.matchAll(/'([^']+)'/gu)].map((match) => match[1]).sort();
}

test("Stripe expiry includes only event types without dedicated handler branches", () => {
  const expiryFunction = latestDefinition(/\bCREATE\s+(?:OR REPLACE\s+)?FUNCTION\s+private\.expire_completed_webhook_payloads\(/iu);
  const expiryIndex = latestDefinition(/\bCREATE\s+INDEX\s+stripe_webhook_events_payload_expiry_idx\b/iu);
  const allowed = expiryEventTypes(expiryFunction);
  assert.deepEqual(expiryEventTypes(expiryIndex), allowed, "The partial index and cleanup must allow the same Stripe types");

  const handler = readFileSync(new URL("../functions/stripe-webhooks/index.ts", import.meta.url), "utf8");
  const dispatch = handler.match(/\bswitch\s*\(event\.type\)\s*\{([\s\S]*?)^ {6}default\s*:/mu)?.[1];
  assert.ok(dispatch, "Review expiry eligibility when the Stripe event dispatch changes");

  const cases = new Set([...dispatch.matchAll(/\bcase\s+(["'\x60])([a-z_.]+)\1\s*:/gu)].map((match) => match[2]));
  for (const type of allowed) {
    assert.ok(!cases.has(type), `Remove ${type} from expiry in a forward migration before deploying its dedicated handler`);
  }
});

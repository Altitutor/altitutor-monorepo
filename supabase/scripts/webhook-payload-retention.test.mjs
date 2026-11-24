import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import ts from "typescript";

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

function stripeDispatchCases() {
  const handler = new URL("../functions/stripe-webhooks/index.ts", import.meta.url);
  const source = ts.createSourceFile(handler.pathname, readFileSync(handler, "utf8"), ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0, "The Stripe handler must parse before checking retention eligibility");

  const dispatches = [];
  function visit(node) {
    if (ts.isSwitchStatement(node) && ts.skipParentheses(node.expression).getText(source) === "event.type") {
      dispatches.push(node.caseBlock);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  assert.equal(dispatches.length, 1, "Review expiry eligibility when the Stripe event dispatch changes");
  const { clauses } = dispatches[0];
  assert.ok(clauses.some(ts.isDefaultClause), "Stripe's receipt-only branch must remain explicit");

  return new Set(clauses.filter(ts.isCaseClause).map(({ expression }) => {
    const label = ts.skipParentheses(expression);
    assert.ok(ts.isStringLiteralLike(label), `Review expiry eligibility for Stripe case ${expression.getText(source)}`);
    return label.text;
  }));
}

test("Stripe expiry includes only event types without dedicated handler branches", () => {
  const expiryFunction = latestDefinition(/\bCREATE\s+(?:OR REPLACE\s+)?FUNCTION\s+private\.expire_completed_webhook_payloads\(/iu);
  const expiryIndex = latestDefinition(/\bCREATE\s+INDEX\s+(?:IF NOT EXISTS\s+)?stripe_webhook_events_payload_expiry_idx\b/iu);
  const allowed = expiryEventTypes(expiryFunction);
  assert.deepEqual(expiryEventTypes(expiryIndex), allowed, "The partial index and cleanup must allow the same Stripe types");

  const handled = stripeDispatchCases();
  for (const type of allowed) {
    assert.ok(!handled.has(type), `Remove ${type} from expiry in a forward migration before deploying its dedicated handler`);
  }
});

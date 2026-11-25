import assert from "node:assert/strict";
import test from "node:test";

import { buildMigrationDatabaseUrl } from "./migration-database-url.mjs";

test("builds a passwordless session-pooler URL with bounded migration timeouts", () => {
  const result = buildMigrationDatabaseUrl(
    "postgresql://postgres.example:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
  );
  const url = new URL(result);

  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.username, "postgres.example");
  assert.equal(url.password, "");
  assert.equal(url.port, "5432");
  assert.match(
    result,
    /options=-c%20statement_timeout%3D30min%20-c%20lock_timeout%3D30s$/,
  );
  assert.equal(
    url.searchParams.get("options"),
    "-c statement_timeout=30min -c lock_timeout=30s",
  );
});

test("rejects non-Postgres pooler URLs", () => {
  assert.throws(
    () => buildMigrationDatabaseUrl("https://example.com/postgres"),
    /Postgres URL/,
  );
});

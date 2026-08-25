import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MIGRATION_OPTIONS = "-c statement_timeout=30min -c lock_timeout=30s";

export function buildMigrationDatabaseUrl(poolerUrl) {
  const url = new URL(poolerUrl.trim());

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Expected a Postgres URL from Supabase link");
  }

  // Keep the database password out of the command line. The deploy workflow
  // supplies it through PGPASSWORD instead.
  url.password = "";

  // Supabase stores a pooler URL during `supabase link`. Port 5432 selects
  // session mode, which is required for connection-level migration settings.
  url.port = "5432";
  url.searchParams.set("options", MIGRATION_OPTIONS);

  return url.toString();
}

function main() {
  const poolerUrlPath = process.argv[2];
  if (!poolerUrlPath) {
    throw new Error("Usage: node migration-database-url.mjs <pooler-url-path>");
  }

  process.stdout.write(
    buildMigrationDatabaseUrl(readFileSync(poolerUrlPath, "utf8")),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

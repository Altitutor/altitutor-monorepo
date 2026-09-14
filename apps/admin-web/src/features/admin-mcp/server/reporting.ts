import postgres from "postgres";
import { parse, toSql } from "pgsql-ast-parser";
import { catalogVersion, datasets } from "./catalog";

const functions = new Set(
  "count sum avg min max round abs ceil ceiling floor trunc coalesce nullif greatest least lower upper length char_length trim btrim ltrim rtrim substring replace concat concat_ws date_trunc date_part age now row_number rank dense_rank lag lead first_value last_value ntile percent_rank cume_dist stddev stddev_pop stddev_samp variance var_pop var_samp bool_and bool_or string_agg array_agg json_agg jsonb_agg json_build_object jsonb_build_object json_array_length jsonb_array_length json_extract_path_text jsonb_extract_path_text to_jsonb unnest".split(
    " ",
  ),
);
const types = new Set(
  "text varchar character bool boolean int int2 int4 int8 integer smallint bigint numeric decimal real float float4 float8 double precision date time timestamp timestamptz interval uuid json jsonb".split(
    " ",
  ),
);
const nodes = new Set(
  "select with union union all table statement ref string integer numeric boolean null call cast binary unary ternary case when extract array arrayIndex member list constant keyword".split(
    " ",
  ),
);
[
  "union all",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "CROSS JOIN",
].forEach((kind) => nodes.add(kind));
const operators = new Set([
  "=",
  "!=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "AND",
  "OR",
  "LIKE",
  "NOT LIKE",
  "ILIKE",
  "NOT ILIKE",
  "IN",
  "NOT IN",
  "IS",
  "IS NOT",
  "IS DISTINCT FROM",
  "IS NOT DISTINCT FROM",
  "||",
  "->",
  "->>",
  "#>",
  "#>>",
  "@>",
  "<@",
  "?",
  "?|",
  "?&",
  "NOT",
  "IS NULL",
  "IS NOT NULL",
  "IS TRUE",
  "IS FALSE",
  "IS NOT TRUE",
  "IS NOT FALSE",
]);

/** Parse, check and serialize: never execute the caller's original SQL text. */
export function prepareReportingQuery(input: string): string {
  if (!input || input.length > 32_000)
    throw new Error("Query must contain 1–32000 characters.");
  let statements;
  try {
    statements = parse(input);
  } catch {
    throw new Error(
      "Unsupported SQL syntax. Use one SELECT or non-recursive read-only WITH query.",
    );
  }
  if (statements.length !== 1)
    throw new Error("Exactly one reporting query is allowed.");
  const ctes = new Set<string>();
  function collect(value: unknown) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (item.type === "with" && Array.isArray(item.bind)) {
      for (const binding of item.bind) ctes.add(binding.alias.name);
    }
    Object.values(item).forEach(collect);
  }
  collect(statements);
  function inspect(value: unknown) {
    if (Array.isArray(value)) return value.forEach(inspect);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (typeof item.type === "string" && !nodes.has(item.type))
      throw new Error(
        `SQL operation ${item.type} is not available for reporting.`,
      );
    if (item.into || item.for || item.forUpdate || item.locking)
      throw new Error("Reporting queries cannot create or lock records.");
    if (item.type === "table") {
      const name = item.name as { schema?: string; name: string };
      if (
        name.schema ? name.schema !== "admin_reporting" : !ctes.has(name.name)
      )
        throw new Error("Use explicitly qualified admin_reporting datasets.");
      if (name.schema && !datasets.some((d) => d.name === name.name))
        throw new Error("Dataset is not in the reporting catalog.");
    }
    if (item.type === "call") {
      const fn = item.function as { schema?: string; name: string };
      if ((fn.schema && fn.schema !== "pg_catalog") || !functions.has(fn.name))
        throw new Error(`Function ${fn.name} is not approved for reporting.`);
    }
    if (item.type === "cast") {
      const target = item.to as { name: string; schema?: string };
      if (
        !types.has(target.name) ||
        (target.schema && target.schema !== "pg_catalog")
      )
        throw new Error("Only built-in reporting value casts are allowed.");
    }
    if (typeof item.op === "string" && !operators.has(item.op))
      throw new Error("Unsupported reporting operator.");
    if (
      typeof item.schema === "string" &&
      !["admin_reporting", "pg_catalog"].includes(item.schema)
    )
      throw new Error("Schema is not available for reporting.");
    Object.values(item).forEach(inspect);
  }
  inspect(statements);
  if (!["select", "with", "union", "union all"].includes(statements[0].type))
    throw new Error("A read-only SELECT is required.");
  return toSql.statement(statements[0]);
}

let activeQueries = 0;
export async function runReportingQuery(
  input: string,
  rowLimit = 200,
  signal?: AbortSignal,
) {
  const query = prepareReportingQuery(input);
  if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 1000)
    throw new Error("rowLimit must be between 1 and 1000.");
  const url = process.env.ADMIN_REPORTING_DATABASE_URL;
  if (!url) throw new Error("Reporting connection is not configured.");
  if (activeQueries >= 4) throw new Error("Reporting is busy; retry shortly.");
  if (signal?.aborted) throw new Error("Query cancelled.");
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 1,
    max_lifetime: 15,
    onnotice: () => undefined,
  });
  activeQueries++;
  const started = Date.now();
  const abort = () => {
    void sql.end({ timeout: 0 });
  };
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 15_000);
  try {
    return await sql.begin("read only", async (tx) => {
      await tx.unsafe("set local statement_timeout = '10s'");
      await tx.unsafe("set local lock_timeout = '1s'");
      await tx.unsafe("set local search_path = pg_catalog, admin_reporting");
      const [identity] = await tx.unsafe("select current_user as role");
      if (identity.role !== "admin_reporting_reader")
        throw new Error("Reporting requires the dedicated reader role.");
      const description = await tx.unsafe(
        `SELECT * FROM (${query}) AS described LIMIT 0`,
      );
      const names = description.columns.map((column) => column.name);
      if (new Set(names).size !== names.length)
        throw new Error("Use distinct aliases for result columns.");
      const precise = description.columns.filter((column) =>
        [20, 1700].includes(column.type),
      );
      const rowJson =
        "to_jsonb(report)" +
        precise
          .map((column) => {
            const key = "'" + column.name.replace(/'/g, "''") + "'";
            const identifier = '"' + column.name.replace(/"/g, '""') + '"';
            return ` || jsonb_build_object(${key}, report.${identifier}::text)`;
          })
          .join("");
      // Size-check each row inside PostgreSQL before it crosses the connection.
      // Fetch one row at a time so aggregates cannot bypass the transport budget.
      const cursor = tx
        .unsafe(
          `SELECT CASE WHEN octet_length((${rowJson})::text) <= 1000000
          THEN ${rowJson} ELSE NULL END AS bounded_row
         FROM (SELECT * FROM (${query}) AS source LIMIT ${rowLimit + 1}) AS report`,
        )
        .cursor(1);
      const rows: Record<string, unknown>[] = [];
      let bytes = 0;
      let truncated = false;
      for await (const batch of cursor) {
        const row = batch[0].bounded_row as Record<string, unknown> | null;
        if (row === null || rows.length === rowLimit) {
          truncated = true;
          break;
        }
        bytes += Buffer.byteLength(JSON.stringify(row));
        if (bytes > 1_000_000) {
          truncated = true;
          break;
        }
        rows.push(row);
      }
      return {
        rows,
        columns: description.columns.map((column) => ({
          name: column.name,
          postgresTypeOid: column.type,
        })),
        truncated,
        returnedRows: rows.length,
        rowLimit,
        catalogVersion,
        queriedAt: new Date(started).toISOString(),
        elapsedMs: Date.now() - started,
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "Reporting requires the dedicated reader role.",
        "Use distinct aliases for result columns.",
      ].includes(error.message)
    )
      throw error;
    // PostgreSQL errors may include data values, source SQL or connection details.
    throw new Error(
      "Reporting query failed. Check catalog fields and value types, or narrow the query to fit its execution limits.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    await sql.end({ timeout: 0 });
    activeQueries--;
  }
}

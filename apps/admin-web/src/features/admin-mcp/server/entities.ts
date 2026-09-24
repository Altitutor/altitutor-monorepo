import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dataset, datasets } from "./catalog";
import { runReportingQuery } from "./reporting";
import { workItemTables, type WorkItemKind } from "./operations";

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
export type EntityFilter = {
  field: string;
  operator: "eq" | "gte" | "lte" | "is_null";
  value?: string | number | boolean;
};
export function entityWhere(name: string, filters: EntityFilter[]) {
  const entry = dataset(name);
  return (
    filters
      .map(({ field, operator, value }) => {
        if (!(field in entry.fields))
          throw new Error(`Unknown field ${field} in ${name}.`);
        if (operator === "is_null") return `"${field}" IS NULL`;
        if (value === undefined) throw new Error("Filter value is required.");
        const op = { eq: "=", gte: ">=", lte: "<=" }[operator];
        return `"${field}" ${op} ${quote(String(value))}`;
      })
      .join(" AND ") || "true"
  );
}
export async function searchEntities(input: {
  dataset: string;
  query?: string;
  filters?: EntityFilter[];
  offset?: number;
  limit?: number;
}) {
  const entry = dataset(input.dataset);
  const predicates = [entityWhere(entry.name, input.filters ?? [])];
  if (input.query)
    predicates.push(
      `to_jsonb(t)::text ILIKE ${quote(`%${input.query.replace(/[\\%_]/g, "\\$&")}%`)}`,
    );
  const offset = input.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
    throw new Error("Invalid offset.");
  const order = "id" in entry.fields ? "id" : Object.keys(entry.fields)[0];
  return runReportingQuery(
    `SELECT t.* FROM admin_reporting.${entry.name} t WHERE ${predicates.join(" AND ")} ORDER BY "${order}" OFFSET ${offset}`,
    input.limit ?? 30,
  );
}
const mentionDatasets: Record<string, string> = {
  student: "students",
  parent: "parents",
  staff: "staff",
  class: "classes",
  session: "sessions",
  invoice: "invoices",
  subject: "subjects",
  topic: "topics",
  file: "topics_files",
  note: "notes_documents",
  task: "tasks",
  issue: "issues",
  project: "projects",
};
export function contentReferences(content: unknown): Array<{
  kind: string;
  dataset: string | null;
  id: string;
  label: string | null;
}> {
  const references: Array<{
    kind: string;
    dataset: string | null;
    id: string;
    label: string | null;
  }> = [];
  function walk(value: unknown, depth: number) {
    if (depth > 30 || references.length > 200) return;
    if (Array.isArray(value))
      return value.forEach((child) => walk(child, depth + 1));
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (
      node.type === "mention" &&
      attrs &&
      typeof attrs.id === "string" &&
      typeof attrs.type === "string"
    )
      references.push({
        kind: attrs.type,
        dataset: mentionDatasets[attrs.type] ?? null,
        id: attrs.id,
        label: typeof attrs.label === "string" ? attrs.label : null,
      });
    Object.values(node).forEach((child) => walk(child, depth + 1));
  }
  walk(content, 0);
  return references;
}
const entityRoutes: Record<string, string> = {
  students: "students",
  parents: "parents",
  staff: "staff",
  classes: "classes",
  sessions: "sessions",
  invoices: "invoices",
  subjects: "subjects",
  topics: "topics",
  issues: "issues",
  tasks: "tasks",
  projects: "projects",
  notes_documents: "documents",
};
function entityLink(name: string, id: string) {
  return entityRoutes[name]
    ? `/${entityRoutes[name]}/${encodeURIComponent(id)}`
    : null;
}
export async function resolveContentReferences(content: unknown) {
  const references = contentReferences(content);
  const groups = new Map<string, Set<string>>();
  for (const ref of references) {
    if (!ref.dataset) continue;
    if (!groups.has(ref.dataset)) groups.set(ref.dataset, new Set());
    groups.get(ref.dataset)!.add(ref.id);
  }
  const resolved = new Map<string, Record<string, unknown>>();
  const incomplete = new Set<string>();
  for (const [name, ids] of groups) {
    const fields = [
      "id",
      "name",
      "title",
      "first_name",
      "last_name",
      "status",
      "topic_id",
      "file_id",
    ].filter((field) => field in dataset(name).fields);
    const result = await runReportingQuery(
      `SELECT ${fields.map((field) => `"${field}"`).join(",")} FROM admin_reporting.${name} WHERE id::text IN (${[...ids].map(quote).join(",")})`,
      250,
    );
    for (const row of result.rows) resolved.set(`${name}:${row.id}`, row);
    if (result.truncated) incomplete.add(name);
  }
  return references.map((ref) => {
    const record = resolved.get(`${ref.dataset}:${ref.id}`);
    return {
      ...ref,
      resolution: record
        ? "resolved"
        : !ref.dataset
          ? "unsupported_kind"
          : incomplete.has(ref.dataset)
            ? "incomplete"
            : "missing",
      context: record ?? null,
      adminUiPath: ref.dataset ? entityLink(ref.dataset, ref.id) : null,
    };
  });
}

function compact(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([field, value]) =>
        ![
          "content",
          "description",
          "note",
          "body",
          "response_json",
          "blocks",
          "draft_blocks",
        ].includes(field) &&
        (value === null || typeof value !== "object"),
    ),
  );
}
export async function getEntity(
  client: SupabaseClient<Database>,
  input: { dataset: string; id: string; full?: boolean },
) {
  const entry = dataset(input.dataset);
  if (!("id" in entry.fields))
    throw new Error(
      "This dataset uses a composite or alternate key. Use search_admin_entities with catalog key fields.",
    );
  const kind = (Object.keys(workItemTables) as WorkItemKind[]).find(
    (key) => workItemTables[key] === entry.name,
  );
  let record: Record<string, unknown>;
  let revision: string | null = null;
  if (kind) {
    const { data, error } = await client.rpc("admin_work_item_read", {
      p_kind: kind,
      p_id: input.id,
    });
    if (error) throw new Error(error.message);
    const result = data as { record: Record<string, Json>; revision: string };
    record = result.record;
    revision = result.revision;
  } else {
    const result = await runReportingQuery(
      `SELECT * FROM admin_reporting.${entry.name} WHERE id=${quote(input.id)}`,
      1,
    );
    if (!result.rows[0]) throw new Error("Entity not found.");
    record = result.rows[0];
  }
  const references = await resolveContentReferences(record);
  return {
    dataset: entry.name,
    adminUiPath: entityLink(entry.name, input.id),
    entityNotes: {
      dataset: "notes",
      filters: [{ field: "target_id", operator: "eq", value: input.id }],
      description:
        "Match both target_id and the existing singular/plural target_type namespace; these are structural notes, not textual mentions.",
    },
    record: input.full ? record : compact(record),
    revision,
    relationships: entry.relationships
      .filter((rel) => record[rel.field] != null)
      .map((rel) => ({ ...rel, targetValue: record[rel.field] })),
    reverseRelationships: datasets.flatMap((source) =>
      source.relationships
        .filter((rel) => rel.dataset === entry.name)
        .map((rel) => ({
          dataset: source.name,
          field: rel.field,
          value: record[rel.targetField],
        })),
    ),
    mentions: references,
    reverseMentionSearch: {
      targetId: input.id,
      description:
        "Search reverse mentions with find_admin_references. Mention links differ from structural relationships.",
    },
  };
}

export async function findReferences(targetId: string, offset = 0) {
  if (!Number.isInteger(offset) || offset < 0)
    throw new Error("Invalid offset.");
  const queries = [
    "issues",
    "tasks",
    "projects",
    "notes_documents",
    "notes",
    "notes_daily",
    "rich_text_templates",
  ].map((name) => {
    const field = ["issues", "tasks", "projects"].includes(name)
      ? "description"
      : name === "notes"
        ? "note"
        : "content";
    return `SELECT ${quote(name)} AS dataset, id, "${field}" AS content FROM admin_reporting.${name} WHERE "${field}"::text ILIKE ${quote(`%${targetId}%`)}`;
  });
  const result = await runReportingQuery(
    `SELECT * FROM (${queries.join(" UNION ALL ")}) refs ORDER BY dataset,id OFFSET ${offset}`,
    100,
  );
  return {
    ...result,
    rows: result.rows
      .map((row) => ({
        dataset: row.dataset,
        id: row.id,
        mentions: contentReferences(row.content).filter(
          (ref) => ref.id === targetId,
        ),
      }))
      .filter((row) => row.mentions.length > 0),
    nextOffset: result.truncated ? offset + result.returnedRows : null,
  };
}

export async function readExistingFile(
  client: SupabaseClient<Database>,
  id: string,
  kind: "file" | "topic_resource",
) {
  let fileId = id;
  if (kind === "topic_resource") {
    const result = await runReportingQuery(
      `SELECT file_id FROM admin_reporting.topics_files WHERE id=${quote(id)}`,
      1,
    );
    if (!result.rows[0]?.file_id) throw new Error("Topic resource not found.");
    fileId = String(result.rows[0].file_id);
  }
  const { data: file, error } = await client
    .from("files")
    .select(
      "id,filename,mimetype,size_bytes,storage_provider,bucket,storage_path,external_url,deleted_at",
    )
    .eq("id", fileId)
    .single();
  if (error || !file || file.deleted_at) throw new Error("File not found.");
  if (file.external_url) {
    const url = new URL(file.external_url);
    if (url.protocol !== "https:")
      throw new Error("Unsupported external file URL.");
    return {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimetype,
      url: url.toString(),
      contentExtraction:
        "Use the client file reader; no server extraction is provided.",
    };
  }
  if (!file.bucket || !file.storage_path)
    throw new Error("File storage metadata is incomplete.");
  const { data, error: signingError } = await client.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 300);
  if (signingError || !data) throw new Error("File access denied.");
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimetype,
    url: data.signedUrl,
    expiresInSeconds: 300,
    contentExtraction:
      "Use the client file reader; no server extraction is provided.",
  };
}

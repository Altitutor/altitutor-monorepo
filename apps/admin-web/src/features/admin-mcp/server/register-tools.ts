import { createHash } from "crypto";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createAdminMcpClient } from "./auth";
import { catalogVersion, dataset, describeCatalog } from "./catalog";
import { runReportingQuery } from "./reporting";
import { captureReportingAuditDiagnostic } from "./reporting-audit-diagnostics";
import {
  changeSchema,
  changeWorkItem,
  operationSchemas,
  type WorkItemKind,
} from "./operations";
import {
  findReferences,
  getEntity,
  readExistingFile,
  searchEntities,
} from "./entities";

async function result(
  operation: () => Promise<unknown> | unknown,
): Promise<CallToolResult> {
  try {
    const value = await operation();
    const structuredContent = { result: value };
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "Operation failed.",
        },
      ],
    };
  }
}
function client(token?: string) {
  if (!token) throw new Error("Authenticated admin MCP access is required.");
  return createAdminMcpClient(token);
}
const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const uuid = z.string().guid('Invalid uuid');
const filter = z
  .object({
    field: z.string(),
    operator: z.enum(["eq", "gte", "lte", "is_null"]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .strict();

type ToolContext = {
  userClient: () => SupabaseClient<Database>;
  signal?: AbortSignal;
  verifiedAt?: unknown;
  includeFileDownloadUrl?: boolean;
};

type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

export type RegisterAdminTool = <Schema extends z.ZodObject>(
  name: string,
  definition: {
    description: string;
    inputSchema: Schema;
    annotations: ToolAnnotations;
  },
  execute: (input: z.output<Schema>, context: ToolContext) => Promise<CallToolResult>,
) => void;

export function defineAdminTools(register: RegisterAdminTool) {
  register(
    "discover_admin_data",
    {
      description:
        "Discover reporting datasets across acquisition, conversion, retention, offering, finance, communication, product and business context. Analytical methods belong to your task, not named reports.",
      inputSchema: z.object({ search: z.string().max(200).optional() }),
      annotations: readAnnotations,
    },
    ({ search }) => result(() => describeCatalog(search)),
  );
  register(
    "describe_admin_dataset",
    {
      description:
        "Read field types, null semantics, relationships and limitations before composing SQL. Use admin_reporting.<name>.",
      inputSchema: z.object({ dataset: z.string() }),
      annotations: readAnnotations,
    },
    (input) =>
      result(() => ({ version: catalogVersion, ...dataset(input.dataset) })),
  );
  register(
    "query_admin_reporting",
    {
      description:
        "Run one read-only PostgreSQL SELECT or WITH query over approved admin_reporting datasets. Supports new joins/cohorts/aggregations/window functions. No arbitrary functions, schema changes or writes. Check truncated before reporting totals; aggregate in SQL. Cross-system data requires separate connectors.",
      inputSchema: z.object({
        sql: z.string().min(1).max(32000),
        rowLimit: z.number().int().min(1).max(1000).default(200),
      }),
      annotations: readAnnotations,
    },
    ({ sql, rowLimit }, extra) =>
      result(async () => {
        const queryStarted = performance.now();
        const output = await runReportingQuery(sql, rowLimit, extra.signal);
        const queryMs = performance.now() - queryStarted;
        const auditStarted = performance.now();
        const { error } = await extra.userClient().rpc(
          "admin_record_reporting_query",
          {
            p_fingerprint: createHash("sha256").update(sql).digest("hex"),
            p_rows: output.returnedRows,
            p_truncated: output.truncated,
          },
        );
        if (error) {
          captureReportingAuditDiagnostic({
            code: error.code,
            verifiedAt: extra.verifiedAt,
            queryMs,
            auditMs: performance.now() - auditStarted,
          });
          throw new Error("Could not record this reporting request.");
        }
        return output;
      }),
  );
  register(
    "search_admin_entities",
    {
      description:
        "Search any catalog dataset by text and typed field filters. Paginated candidates include IDs; disambiguate before changing anything.",
      inputSchema: z.object({
        dataset: z.string(),
        query: z.string().max(200).optional(),
        filters: z.array(filter).max(20).optional(),
        offset: z.number().int().min(0).max(100000).default(0),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: readAnnotations,
    },
    (input) => result(() => searchEntities(input)),
  );
  register(
    "get_admin_entity",
    {
      description:
        "Read an entity with its revision, structural relationships, reverse relationship filters and rich-text references. full=true includes content. Read current revision before editing. For alternate/composite keys use search filters.",
      inputSchema: z.object({
        dataset: z.string(),
        id: uuid,
        full: z.boolean().default(false),
      }),
      annotations: readAnnotations,
    },
    (input, extra) =>
      result(() => getEntity(extra.userClient(), input)),
  );
  register(
    "find_admin_references",
    {
      description:
        "Find incoming rich-text mentions of an entity across work items and staff content. Mentions differ from structural relationships. Follow nextOffset until null.",
      inputSchema: z.object({
        targetId: uuid,
        offset: z.number().int().min(0).max(100000).default(0),
      }),
      annotations: readAnnotations,
    },
    ({ targetId, offset }) => result(() => findReferences(targetId, offset)),
  );
  register(
    "read_admin_file",
    {
      description:
        "Retrieve authorised existing file metadata and a short-lived download URL. kind=file uses files.id; kind=topic_resource uses topics_files.id (rich-text file mentions). No uploading, deleting or automatic binary text extraction.",
      inputSchema: z.object({
        id: uuid,
        kind: z.enum(["file", "topic_resource"]).default("file"),
      }),
      annotations: readAnnotations,
    },
    ({ id, kind }, extra) =>
      result(() => readExistingFile(extra.userClient(), id, kind, extra.includeFileDownloadUrl)),
  );
  register(
    "get_admin_change_history",
    {
      description:
        "Read attributable before/after history for an operational entity. Page in batches of 50. This differs from lifecycle events.",
      inputSchema: z.object({
        kind: z.enum([
          "issue",
          "task",
          "project",
          "document",
          "note",
          "folder",
          "template",
        ]),
        id: uuid,
        offset: z.number().int().min(0).default(0),
      }),
      annotations: readAnnotations,
    },
    (input, extra) =>
      result(async () => {
        const { data, error } = await extra.userClient().rpc(
          "admin_work_item_history",
          { p_kind: input.kind, p_id: input.id, p_offset: input.offset },
        );
        if (error) throw new Error(error.message);
        return {
          changes: data,
          nextOffset:
            Array.isArray(data) && data.length === 50
              ? input.offset + 50
              : null,
        };
      }),
  );
  for (const kind of Object.keys(operationSchemas) as WorkItemKind[]) {
    register(
      `create_admin_${kind}`,
      {
        description: `Create an operational ${kind}. Reuse idempotencyKey on retries. Content accepts plain text or native Tiptap JSON; business reports belong in your conversation, not staff documents.`,
        inputSchema: z.object({
          properties: operationSchemas[kind],
          idempotencyKey: z.string().min(1).max(200),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (input, extra) =>
        result(() =>
          changeWorkItem(extra.userClient(), { kind, ...input }),
        ),
    );
    register(
      `change_admin_${kind}`,
      {
        description: `Change supported ${kind} properties atomically using the revision from get_admin_entity. Omission preserves fields; null explicitly clears nullable fields. Re-read on conflict. Document visibility changes take effect for tutors. Mark work complete only when its underlying work is done.`,
        inputSchema: z.object({
          id: uuid,
          revision: z.string().regex(/^\d+$/),
          changes: changeSchema(kind),
          idempotencyKey: z.string().min(1).max(200),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (input, extra) =>
        result(() =>
          changeWorkItem(extra.userClient(), {
            kind,
            id: input.id,
            revision: input.revision,
            properties: input.changes,
            idempotencyKey: input.idempotencyKey,
          }),
        ),
    );
  }
}

export function registerAdminMcpTools(server: McpServer) {
  defineAdminTools((name, definition, execute) => {
    server.registerTool<z.ZodType, z.ZodObject>(name, definition, async (input, extra) =>
      execute(definition.inputSchema.parse(input), {
        userClient: () => client(extra.http?.authInfo?.token),
        signal: extra.mcpReq.signal,
        verifiedAt: extra.http?.authInfo?.extra?.verifiedAt,
      }),
    );
  });
}

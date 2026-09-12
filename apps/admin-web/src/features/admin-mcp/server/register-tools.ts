import { createHash } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createAdminMcpClient } from "./auth";
import { catalogVersion, dataset, describeCatalog } from "./catalog";
import { runReportingQuery } from "./reporting";
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
const uuid = z.string().uuid();
const filter = z
  .object({
    field: z.string(),
    operator: z.enum(["eq", "gte", "lte", "is_null"]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .strict();

export function registerAdminMcpTools(server: McpServer) {
  server.registerTool(
    "discover_admin_data",
    {
      description:
        "Discover reporting datasets across acquisition, conversion, retention, offering, finance, communication, product and business context. Analytical methods belong to your task, not named reports.",
      inputSchema: { search: z.string().max(200).optional() },
      annotations: readAnnotations,
    },
    ({ search }) => result(() => describeCatalog(search)),
  );
  server.registerTool(
    "describe_admin_dataset",
    {
      description:
        "Read field types, null semantics, relationships and limitations before composing SQL. Use admin_reporting.<name>.",
      inputSchema: { dataset: z.string() },
      annotations: readAnnotations,
    },
    (input) =>
      result(() => ({ version: catalogVersion, ...dataset(input.dataset) })),
  );
  server.registerTool(
    "query_admin_reporting",
    {
      description:
        "Run one read-only PostgreSQL SELECT or WITH query over approved admin_reporting datasets. Supports new joins/cohorts/aggregations/window functions. No arbitrary functions, schema changes or writes. Check truncated before reporting totals; aggregate in SQL. Cross-system data requires separate connectors.",
      inputSchema: {
        sql: z.string().min(1).max(32000),
        rowLimit: z.number().int().min(1).max(1000).default(200),
      },
      annotations: readAnnotations,
    },
    ({ sql, rowLimit }, extra) =>
      result(async () => {
        const output = await runReportingQuery(sql, rowLimit, extra.signal);
        const { error } = await client(extra.authInfo?.token).rpc(
          "admin_record_reporting_query",
          {
            p_fingerprint: createHash("sha256").update(sql).digest("hex"),
            p_rows: output.returnedRows,
            p_truncated: output.truncated,
          },
        );
        if (error) throw new Error("Could not record this reporting request.");
        return output;
      }),
  );
  server.registerTool(
    "search_admin_entities",
    {
      description:
        "Search any catalog dataset by text and typed field filters. Paginated candidates include IDs; disambiguate before changing anything.",
      inputSchema: {
        dataset: z.string(),
        query: z.string().max(200).optional(),
        filters: z.array(filter).max(20).optional(),
        offset: z.number().int().min(0).max(100000).default(0),
        limit: z.number().int().min(1).max(100).default(30),
      },
      annotations: readAnnotations,
    },
    (input) => result(() => searchEntities(input)),
  );
  server.registerTool(
    "get_admin_entity",
    {
      description:
        "Read an entity with its revision, structural relationships, reverse relationship filters and rich-text references. full=true includes content. Read current revision before editing. For alternate/composite keys use search filters.",
      inputSchema: {
        dataset: z.string(),
        id: uuid,
        full: z.boolean().default(false),
      },
      annotations: readAnnotations,
    },
    (input, extra) =>
      result(() => getEntity(client(extra.authInfo?.token), input)),
  );
  server.registerTool(
    "find_admin_references",
    {
      description:
        "Find incoming rich-text mentions of an entity across work items and staff content. Mentions differ from structural relationships. Follow nextOffset until null.",
      inputSchema: {
        targetId: uuid,
        offset: z.number().int().min(0).max(100000).default(0),
      },
      annotations: readAnnotations,
    },
    ({ targetId, offset }) => result(() => findReferences(targetId, offset)),
  );
  server.registerTool(
    "read_admin_file",
    {
      description:
        "Retrieve authorised existing file metadata and a short-lived download URL. kind=file uses files.id; kind=topic_resource uses topics_files.id (rich-text file mentions). No uploading, deleting or automatic binary text extraction.",
      inputSchema: {
        id: uuid,
        kind: z.enum(["file", "topic_resource"]).default("file"),
      },
      annotations: readAnnotations,
    },
    ({ id, kind }, extra) =>
      result(() => readExistingFile(client(extra.authInfo?.token), id, kind)),
  );
  server.registerTool(
    "get_admin_change_history",
    {
      description:
        "Read attributable before/after history for an operational entity. Page in batches of 50. This differs from lifecycle events.",
      inputSchema: {
        kind: z.enum([
          "issue",
          "task",
          "project",
          "document",
          "note",
          "folder",
          "daily_note",
          "template",
        ]),
        id: uuid,
        offset: z.number().int().min(0).default(0),
      },
      annotations: readAnnotations,
    },
    (input, extra) =>
      result(async () => {
        const { data, error } = await client(extra.authInfo?.token).rpc(
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
    server.registerTool(
      `create_admin_${kind}`,
      {
        description: `Create an operational ${kind}. Reuse idempotencyKey on retries. Content accepts plain text or native Tiptap JSON; business reports belong in your conversation, not staff documents.`,
        inputSchema: {
          properties: operationSchemas[kind],
          idempotencyKey: z.string().min(1).max(200),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (input, extra) =>
        result(() =>
          changeWorkItem(client(extra.authInfo?.token), { kind, ...input }),
        ),
    );
    server.registerTool(
      `change_admin_${kind}`,
      {
        description: `Change supported ${kind} properties atomically using the revision from get_admin_entity. Omission preserves fields; null explicitly clears nullable fields. Re-read on conflict. Document visibility changes take effect for tutors. Mark work complete only when its underlying work is done.`,
        inputSchema: {
          id: uuid,
          revision: z.string().regex(/^\d+$/),
          changes: changeSchema(kind),
          idempotencyKey: z.string().min(1).max(200),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (input, extra) =>
        result(() =>
          changeWorkItem(client(extra.authInfo?.token), {
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

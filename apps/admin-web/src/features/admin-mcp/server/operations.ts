import type { Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import {
  operationSchemas,
  changeSchema,
  type WorkItemKind,
} from "../contracts";
export { operationSchemas, changeSchema, workItemTables } from "../contracts";
export type { WorkItemKind } from "../contracts";

function normalizeContent(fields: Record<string, Json>): Record<string, Json> {
  const result = { ...fields };
  for (const key of ["description", "content", "note"]) {
    const value = result[key];
    if (typeof value === "string")
      result[key] = {
        type: "doc",
        content: value.split("\n").map((line) => ({
          type: "paragraph",
          content: line ? [{ type: "text", text: line }] : [],
        })),
      };
  }
  return result;
}

export async function changeWorkItem(
  client: SupabaseClient<Database>,
  input: {
    kind: WorkItemKind;
    id?: string;
    revision?: string;
    idempotencyKey: string;
    properties: unknown;
  },
) {
  const schema = input.id
    ? changeSchema(input.kind)
    : operationSchemas[input.kind];
  const parsed = schema.parse(input.properties) as Record<string, Json>;
  if (JSON.stringify(parsed).length > 500_000)
    throw new Error("Work item content is too large.");
  if (input.id && (!input.revision || !/^\d+$/.test(input.revision)))
    throw new Error(
      "Read the work item before editing and supply its revision.",
    );
  const { data, error } = await client.rpc("admin_work_item_change", {
    p_kind: input.kind,
    p_id: input.id,
    p_revision: input.revision ? Number(input.revision) : undefined,
    p_key: input.idempotencyKey,
    p_changes: normalizeContent(parsed),
  });
  if (error) throw new Error(error.message);
  return data;
}

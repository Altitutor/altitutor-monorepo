import {
  operationSchemas,
  changeSchema,
  type WorkItemKind,
} from "../contracts";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

/** Conservative editor baseline: unrelated refreshes never authorize an overwrite. */
export class WorkItemRevisions {
  private readonly revisions = new Map<string, number>();
  private pending: Promise<unknown> = Promise.resolve();

  observe(value: unknown, depth = 0): void {
    if (!value || typeof value !== "object" || depth > 8) return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id === "string" &&
      typeof record.admin_revision === "number" &&
      !this.revisions.has(record.id)
    ) {
      this.revisions.set(record.id, record.admin_revision);
    }
    for (const child of Object.values(record)) this.observe(child, depth + 1);
  }

  change = <T>(
    id: string,
    save: (revision: number) => Promise<T>,
  ): Promise<T> => {
    const change = this.pending.then(async () => {
      const revision = this.revisions.get(id);
      if (revision === undefined)
        throw new Error(
          "Reopen this editor to load its revision before editing.",
        );
      const result = await save(revision);
      const record = result as Record<string, unknown>;
      if (record?.id === id && typeof record.admin_revision === "number") {
        this.revisions.set(id, record.admin_revision);
      }
      return result;
    });
    this.pending = change.catch(() => undefined);
    return change;
  };
}

/** Capture first observed records for this mounted editor and advance only our own acknowledged writes. */
export function useWorkItemRevision(editorSession?: string | boolean) {
  const cache = useQueryClient();
  const baseline = useMemo(() => {
    const revisions = new WorkItemRevisions();
    if (editorSession === false) return revisions;
    for (const query of cache.getQueryCache().getAll())
      revisions.observe(query.state.data);
    return revisions;
  }, [cache, editorSession]);
  useEffect(() => {
    if (editorSession === false) return;
    const queries = cache.getQueryCache();
    for (const query of queries.getAll()) baseline.observe(query.state.data);
    return queries.subscribe((event) =>
      baseline.observe(event.query.state.data),
    );
  }, [cache, baseline, editorSession]);
  return baseline.change;
}

export async function mutateWorkItem<T>(
  kind: WorkItemKind,
  properties: unknown,
  id?: string,
  revision?: number,
): Promise<T> {
  if (id && revision === undefined)
    throw new Error("Read the work item before editing.");
  const fields = Object.fromEntries(
    Object.entries(properties as Record<string, Json>).filter(
      ([key, value]) =>
        key in (id ? changeSchema(kind) : operationSchemas[kind]).shape &&
        value !== undefined,
    ),
  );
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase.rpc("admin_work_item_change", {
    p_kind: kind,
    p_id: id,
    p_revision: revision,
    p_key: crypto.randomUUID(),
    p_changes: fields,
  });
  if (error) throw new Error(error.message);
  return (data as { record: Json }).record as T;
}

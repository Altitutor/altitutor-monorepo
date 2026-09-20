import type { Json } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

export type EditKind = "task" | "issue" | "project" | "document";
export type EditRecord = Record<string, Json | undefined>;
export interface EditSession {
  record: EditRecord;
  token: string | null;
  can_edit: boolean;
  owner: string | null;
  expires_at: string | null;
  preview: EditRecord | null;
  user_id: string;
}
export async function editOperation(
  kind: EditKind,
  id: string,
  action: string,
  token?: string | null,
  changes?: EditRecord | null,
  key?: string,
): Promise<EditSession> {
  const { data, error } = await getSupabaseClient().rpc(
    "admin_work_item_edit",
    {
      p_kind: kind,
      p_id: id,
      p_action: action,
      p_token: token ?? undefined,
      p_changes: changes as Json | undefined,
      p_key: key,
    },
  );
  if (error)
    throw Object.assign(new Error(error.message), { code: error.code });
  return data as unknown as EditSession;
}

/** One-off list actions respect the same lock as the detail editors. */
export async function deleteWorkItem(
  kind: EditKind,
  id: string,
): Promise<void> {
  const session = await editOperation(kind, id, "acquire");
  if (!session.can_edit)
    throw new Error(
      `${session.owner ?? "Someone else"} is editing this item. Try again when they close it.`,
    );
  try {
    await editOperation(kind, id, "delete", session.token);
  } catch (error) {
    await editOperation(kind, id, "release", session.token).catch(
      () => undefined,
    );
    throw error;
  }
}

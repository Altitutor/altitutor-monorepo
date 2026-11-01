import "server-only";
import { getMailboxPolicy } from "./config";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailMessageSchema } from "../types";
import type { GraphMailMessage } from "./graph";
/** Commands and recovery use the same merge/projection rules as delta pages. */
export async function observeMailboxMessage(
  db: SupabaseClient<Database>,
  message: GraphMailMessage & {
    replyToMessageId?: string;
    replyTargetVersion?: string;
    draftMode?: "new" | "reply" | "replyAll" | "forward";
  },
  address = getMailboxPolicy().address,
) {
  const saved = await db.rpc("email_apply_sync_page", {
    p_mailbox_address: address,
    p_folder_id: message.folderId,
    p_expected_cursor: "",
    p_cursor: "",
    p_complete: false,
    p_removed_ids: [],
    p_observation_only: true,
    p_messages: JSON.parse(
      JSON.stringify([{ ...message, folderId: message.folderId || undefined }]),
    ) as Json,
  });
  if (saved.error) throw saved.error;
  const current = await db
    .from("email_messages")
    .select("data,thread_id,folder_id,id,removed")
    .eq("id", message.id)
    .single();
  if (current.error) throw current.error;
  const data = current.data.data;
  return emailMessageSchema.parse({
    ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
    id: current.data.id,
    threadId: current.data.thread_id,
    folderId: current.data.folder_id,
    removed: current.data.removed,
  });
}

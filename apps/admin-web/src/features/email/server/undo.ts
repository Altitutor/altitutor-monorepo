import "server-only";
import { z } from "zod";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { createGraphMailbox } from "./graph";
import { observeMailboxMessage } from "./observe";
const messageUndoSchema = z.object({
  kind: z.enum(["read", "move"]),
  messages: z.array(
    z.object({
      id: z.string(),
      changeKey: z.string(),
      read: z.boolean().optional(),
      folderId: z.string().optional(),
    }),
  ),
});
const assignmentUndoSchema = z.object({
  kind: z.literal("assignment"),
  threadId: z.string(),
  staffId: z.string().nullable(),
  assignedAt: z.string().nullable(),
  version: z.number(),
});
export type MessageUndo = z.infer<typeof messageUndoSchema>;
export async function rememberMailUndo(
  db: SupabaseClient<Database>,
  staffId: string,
  payload: MessageUndo,
) {
  if (!payload.messages.length) return [];
  const result = await db
    .from("email_command_undos")
    .insert({ staff_id: staffId, payload: payload as Json })
    .select("id")
    .single();
  if (result.error)
    throw new Error(
      "The mailbox action completed, but its Undo could not be saved. Refresh to check its result.",
    );
  return [result.data.id];
}
export async function undoMail(
  db: SupabaseClient<Database>,
  staffId: string,
  connect: () => Promise<ReturnType<typeof createGraphMailbox>>,
  ids: string[],
) {
  for (const id of ids) {
    // DELETE RETURNING is the single-use claim. Only the original actor may undo.
    const claimed = await db
      .from("email_command_undos")
      .delete()
      .eq("id", id)
      .eq("staff_id", staffId)
      .gt("expires_at", new Date().toISOString())
      .select("payload")
      .maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data)
      throw new Error("Undo expired or has already been used.");
    const assignment = assignmentUndoSchema.safeParse(claimed.data.payload);
    if (assignment.success) {
      const value = assignment.data;
      const restored = await db.rpc("email_undo_assignment", {
        p_thread_id: value.threadId,
        p_staff_id: value.staffId!,
        p_assigned_at: value.assignedAt!,
        p_version: value.version,
      });
      if (restored.error) throw restored.error;
      continue;
    }
    const receipt = messageUndoSchema.parse(claimed.data.payload);
    const mailbox = await connect();
    // Preflight all members before restoring any of this batch.
    for (const message of receipt.messages) {
      const current = await mailbox.message(message.id);
      if (current.changeKey !== message.changeKey)
        throw new Error(
          "This email changed since the action. The newer Outlook change was not overwritten.",
        );
    }
    for (const message of receipt.messages) {
      if (receipt.kind === "move" && message.folderId) {
        await observeMailboxMessage(
          db,
          await mailbox.move(message.id, message.folderId),
          mailbox.policy.address,
        );
      } else if (receipt.kind === "read" && message.read !== undefined) {
        await mailbox.setRead(message.id, message.read);
        await observeMailboxMessage(
          db,
          await mailbox.message(message.id),
          mailbox.policy.address,
        );
      }
    }
  }
  return { state: "undone" };
}

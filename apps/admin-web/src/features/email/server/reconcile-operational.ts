import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { observeMailboxMessage } from "./observe";
import { GraphMailboxError, type createGraphMailbox } from "./graph";
/** Observe unresolved provider work; recovery never repeats an uncertain send. */
export async function reconcileOperationalMail(
  db: SupabaseClient<Database>,
  mailbox: ReturnType<typeof createGraphMailbox>,
) {
  const pending = await db
    .from("email_operational_sends")
    .select("id,state,draft_id,updated_at")
    .in("state", [
      "creating",
      "sending",
      "submitted",
      "uncertain_create",
      "uncertain_send",
    ])
    .order("updated_at")
    .limit(2);
  if (pending.error) throw pending.error;
  for (const operation of pending.data) {
    // Allow the foreground request to finish; crashed requests become visible
    // to this observer without authorizing another external submission.
    if (Date.now() - new Date(operation.updated_at).getTime() < 30_000)
      continue;
    try {
      const message = operation.draft_id
        ? await mailbox.message(operation.draft_id)
        : await mailbox.findOperation(operation.id);
      if (!message) continue;
      if (!operation.draft_id) {
        const attached = await db
          .from("email_operational_sends")
          .update({
            draft_id: message.id,
            change_key: message.changeKey ?? null,
            state: "uncertain_create",
          })
          .eq("id", operation.id)
          .eq("state", operation.state);
        if (attached.error) throw attached.error;
      }
      await observeMailboxMessage(db, message);
    } catch (error) {
      if (!(error instanceof GraphMailboxError && error.status === 404))
        throw error;
    } finally {
      // Rotate unresolved entries fairly even when a provider item is missing.
      await db
        .from("email_operational_sends")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", operation.id)
        .eq("state", operation.state);
    }
  }
}

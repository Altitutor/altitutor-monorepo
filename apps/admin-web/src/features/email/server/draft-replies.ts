import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailMessage } from "../types";
import type { createGraphMailbox } from "./graph";
/** Older/Outlook drafts have no portal origin. Read explicit reply headers only.
 * Enrichment has one shared connection, at most three reads and a shared 1.2s
 * deadline; cached conversations stay readable during provider outages. */
export async function resolveDraftReplyTargets(
  db: SupabaseClient<Database>,
  messages: EmailMessage[],
  connect: () => Promise<ReturnType<typeof createGraphMailbox>>,
  address: string,
) {
  const results = [...messages];
  const candidates = messages
    .map((message, index) => ({ message, index }))
    .filter(
      ({ message }) =>
        message.draft &&
        !message.removed &&
        !message.replyToMessageId &&
        !message.draftMode &&
        message.changeKey &&
        message.replyTargetVersion !== message.changeKey,
    );
  if (!candidates.length) return results;
  const deadline = AbortSignal.timeout(1200);
  const aborted = new Promise<never>((_resolve, reject) => {
    deadline.addEventListener(
      "abort",
      () => reject(new Error("Reply lookup deadline reached")),
      { once: true },
    );
  });
  let connection: Promise<ReturnType<typeof createGraphMailbox>> | undefined;
  for (const { index, message } of candidates.slice(0, 3)) {
    if (deadline.aborted) break;
    try {
      connection ??= Promise.race([connect(), aborted]);
      const mailbox = await connection;
      if (mailbox.policy.address !== address) break;
      const current = await mailbox.message(message.id, true, deadline);
      if (!current.draft || current.changeKey !== message.changeKey) continue;
      const targets = current.replyToInternetMessageIds ?? [];
      const saved = await db
        .rpc("email_cache_draft_reply_targets", {
          p_message_id: message.id,
          p_change_key: message.changeKey!,
          p_targets: targets,
        })
        .abortSignal(deadline);
      if (saved.error) throw saved.error;
      if (saved.data)
        results[index] = {
          ...message,
          replyToInternetMessageIds: targets,
          replyTargetVersion: message.changeKey,
        };
    } catch {
      // Do not retry a failed connection/lookup for every remaining draft.
      // No provider body is written, and an unknown target is never guessed.
      break;
    }
  }
  return results;
}

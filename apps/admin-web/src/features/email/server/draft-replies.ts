import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailMessage } from "../types";
import type { createGraphMailbox } from "./graph";
import { observeMailboxMessage } from "./observe";
/** Older/Outlook drafts have no portal origin. Read only their explicit reply headers,
 * once per provider version; never infer a reply target from subject or recipients. */
export async function resolveDraftReplyTargets(
  db: SupabaseClient<Database>,
  messages: EmailMessage[],
  connect: () => Promise<ReturnType<typeof createGraphMailbox>>,
  address: string,
) {
  let mailbox: ReturnType<typeof createGraphMailbox> | undefined;
  const results: EmailMessage[] = [];
  for (const message of messages) {
    if (
      !message.draft ||
      message.removed ||
      message.replyToMessageId ||
      message.draftMode ||
      (message.changeKey && message.replyTargetVersion === message.changeKey)
    ) {
      results.push(message);
      continue;
    }
    try {
      mailbox ??= await connect();
      const current = await mailbox.message(message.id, true);
      results.push(
        await observeMailboxMessage(
          db,
          { ...current, replyTargetVersion: current.changeKey ?? "" },
          address,
        ),
      );
    } catch {
      // Cached mail remains available during provider outages. An unknown target is
      // deliberately not offered as an existing reply; a later open can retry.
      results.push(message);
    }
  }
  return results;
}

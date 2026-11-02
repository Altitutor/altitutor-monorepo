import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertMailboxRecipients } from "@altitutor/email";
import type { createGraphMailbox } from "./graph";
import { GraphMailboxError } from "./graph";
import { observeMailboxMessage } from "./observe";

/** One atomic reservation precedes every external submission, including cron. */
export async function dispatchScheduledMail(
  db: SupabaseClient<Database>,
  mailbox: ReturnType<typeof createGraphMailbox>,
  commandId?: string,
) {
  const claimed = commandId
    ? await db.rpc("email_claim_scheduled_send", { p_command_id: commandId })
    : await db.rpc("email_claim_scheduled_sends");
  if (claimed.error) throw claimed.error;
  for (const attempt of claimed.data ?? []) {
    let state = "uncertain";
    try {
      const staff = await db
        .from("staff")
        .select("id")
        .eq("id", attempt.staff_id)
        .eq("role", "ADMINSTAFF")
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (staff.error) throw staff.error;
      if (!staff.data) state = "paused";
      else {
        const current = await mailbox.message(attempt.message_id);
        await observeMailboxMessage(db, current, mailbox.policy.address);
        if (!current.draft || current.changeKey !== attempt.change_key)
          state = current.sentAt && !current.draft ? "sent" : "paused";
        else {
          const recipients = {
            to: current.to ?? [],
            cc: current.cc ?? [],
            bcc: current.bcc ?? [],
          };
          // Recheck the environment allowlist at dispatch, not just scheduling.
          try {
            assertMailboxRecipients(mailbox.policy, recipients);
          } catch {
            state = "paused";
          }
          if (state !== "paused")
            state = (await mailbox.sendDraft(attempt.message_id, recipients))
              .state;
        }
      }
    } catch (error) {
      // A missing/changed Outlook draft requires human review. Any other failure
      // is uncertain and never becomes an automatic second submission.
      if (error instanceof GraphMailboxError && error.status === 404)
        state = "paused";
    }
    const recorded = await db
      .from("email_send_attempts")
      .update({ state, updated_at: new Date().toISOString() })
      .eq("command_id", attempt.command_id)
      .neq("state", "sent");
    if (recorded.error) throw recorded.error;
  }
  return (claimed.data ?? []).length;
}

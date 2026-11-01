import "server-only";
import { z } from "zod";
import { assertMailboxRecipients } from "@altitutor/email";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type EmailCommand } from "../types";
import { connectMailbox } from "./connection";
import { observeMailboxMessage } from "./observe";
import { type createGraphMailbox } from "./graph";

const claimSchema = z.object({
  state: z.string(),
  proceed: z.boolean().optional(),
});
type Staff = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};
export function mailboxCommands(
  db: SupabaseClient<Database>,
  staff: Staff,
  connector?: ReturnType<typeof createGraphMailbox>,
) {
  return async (command: EmailCommand) => {
    if (command.action === "assign") {
      const result = await db.rpc("email_assign_thread", {
        p_thread_id: command.threadId,
        p_staff_id: command.staffId!,
      });
      if (result.error) throw result.error;
      return result.data;
    }
    if (command.action === "link") {
      const result = await db.rpc("email_link_record", {
        p_thread_id: command.threadId,
        p_record_type: command.recordType,
        p_record_id: command.recordId,
      });
      if (result.error) throw result.error;
      return result.data;
    }
    const mailbox = connector ?? (await connectMailbox());
    const observe = (message: Awaited<ReturnType<typeof mailbox.message>>) =>
      observeMailboxMessage(db, message, mailbox.policy.address);
    if (command.action === "read" || command.action === "move") {
      for (const id of command.ids) {
        if (command.action === "read") {
          await mailbox.setRead(id, command.read);
          await observe(await mailbox.message(id));
        } else {
          // Microsoft resolves well-known archive/deleteditems names itself.
          await observe(await mailbox.move(id, command.folderId));
        }
      }
      return { state: "saved" };
    }
    if (command.action === "draft") {
      if (command.mode !== "new" && !command.messageId)
        throw new Error("Original message required.");
      const draft =
        command.mode === "forward"
          ? await mailbox.forwardDraft(command.messageId!, command.to ?? [])
          : await mailbox.createDraft(
              command.mode === "new"
                ? undefined
                : { messageId: command.messageId!, mode: command.mode },
            );
      const cached = await observe(draft);
      const signature = await db
        .from("email_signatures")
        .select("body_text")
        .eq("staff_id", staff.id)
        .maybeSingle();
      if (signature.error) throw signature.error;
      return {
        state: "draft",
        message: cached,
        signature:
          signature.data?.body_text ??
          `${[staff.first_name, staff.last_name].filter(Boolean).join(" ")}\nAltitutor`,
      };
    }
    if (command.action === "save") {
      const claimed = await db.rpc("email_claim_draft", {
        p_message_id: command.id,
        p_change_key: command.content.expectedChangeKey,
        p_staff_id: staff.id,
        p_token: command.editToken,
      });
      if (claimed.error) throw claimed.error;
      const claim = claimSchema.parse(claimed.data);
      if (claim.state === "conflict")
        return {
          state: "conflict",
          message: await observe(await mailbox.message(command.id)),
        };
      if (claim.state !== "ready") return claim;
      try {
        const result = await mailbox.saveDraft(command.id, command.content);
        const message = await observe(result.message);
        return { ...result, message };
      } finally {
        const released = await db
          .from("email_draft_edits")
          .update({ writing_until: null })
          .eq("message_id", command.id)
          .eq("token", command.editToken);
        if (released.error) throw released.error;
      }
    }
    // Check Outlook once more before claiming the irreversible send. The
    // read/check/send window is still subject to Microsoft's cross-client race.
    const current = await mailbox.message(command.id);
    if (!current.draft || current.changeKey !== command.changeKey) {
      if (current.draft) await observe(current);
      return { state: "conflict", message: current };
    }
    const recipients = {
      to: current.to ?? [],
      cc: current.cc ?? [],
      bcc: current.bcc ?? [],
    };
    assertMailboxRecipients(mailbox.policy, recipients);
    const claimed = await db.rpc("email_begin_send", {
      p_message_id: command.id,
      p_change_key: command.changeKey,
      p_staff_id: staff.id,
      p_command_id: command.commandId,
    });
    if (claimed.error) throw claimed.error;
    const claim = claimSchema.parse(claimed.data);
    if (!claim.proceed) {
      if (claim.state === "conflict")
        return {
          state: "conflict",
          message: await observe(await mailbox.message(command.id)),
        };
      return claim;
    }
    const result = await mailbox.sendDraft(command.id, recipients);
    const recorded = await db
      .from("email_send_attempts")
      .update({ state: result.state, updated_at: new Date().toISOString() })
      .eq("message_id", command.id)
      .eq("command_id", command.commandId)
      .neq("state", "sent");
    if (recorded.error)
      throw new Error(
        "Send outcome could not be saved. Refresh to reconcile this draft before any further action.",
      );
    return result;
  };
}

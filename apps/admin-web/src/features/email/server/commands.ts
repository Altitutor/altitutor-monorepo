import "server-only";
import { z } from "zod";
import { assertMailboxRecipients } from "@altitutor/email";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type EmailCommand } from "../types";
import { dispatchScheduledMail } from "./scheduled";
import { rememberMailUndo, undoMail, type MessageUndo } from "./undo";
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
      const result = await db.rpc("email_assign_with_undo", {
        p_thread_id: command.threadId,
        p_staff_id: command.staffId!,
        p_actor_id: staff.id,
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
    if (command.action === "releaseDraft") {
      const released = await db
        .from("email_draft_edits")
        .delete()
        .eq("message_id", command.id)
        .eq("staff_id", staff.id)
        .eq("token", command.editToken)
        .is("writing_until", null);
      if (released.error) throw released.error;
      return { state: "released" };
    }
    if (command.action === "cancelSchedule") {
      const result = await db.rpc("email_cancel_schedule", {
        p_command_id: command.id,
      });
      if (result.error) throw result.error;
      const outcome = claimSchema.parse(result.data);
      if (outcome.state !== "cancelled")
        throw new Error(
          "Delivery has already started; it cannot be cancelled.",
        );
      return outcome;
    }
    if (command.action === "undo")
      return undoMail(
        db,
        staff.id,
        async () => connector ?? (await connectMailbox()),
        command.ids,
      );
    const mailbox = connector ?? (await connectMailbox());
    const observe = (message: Parameters<typeof observeMailboxMessage>[1]) =>
      observeMailboxMessage(db, message, mailbox.policy.address);
    if (command.action === "dispatchQueued") {
      await dispatchScheduledMail(db, mailbox, command.id);
      return { state: "dispatched" };
    }
    if (command.action === "read" || command.action === "move") {
      const receipt: MessageUndo = { kind: command.action, messages: [] };
      let failure: unknown;
      for (const id of command.ids) {
        try {
          const before = await mailbox.message(id);
          const after =
            command.action === "read"
              ? (await mailbox.setRead(id, command.read),
                await mailbox.message(id))
              : await mailbox.move(id, command.folderId);
          if (
            after.changeKey &&
            (command.action === "read"
              ? before.read !== after.read
              : before.folderId !== after.folderId)
          ) {
            receipt.messages.push({
              id: after.id,
              changeKey: after.changeKey,
              ...(command.action === "read"
                ? { read: before.read }
                : { folderId: before.folderId }),
            });
          }
          await observe(after);
        } catch (error) {
          failure = error;
          break;
        }
      }
      if (failure && !receipt.messages.length) throw failure;
      const undoIds =
        command.action === "read" && command.silent
          ? []
          : await rememberMailUndo(db, staff.id, receipt);
      return {
        state: failure ? "partial" : "saved",
        undoIds,
        ...(failure
          ? {
              error:
                "Some emails could not be changed. Refresh to review; Undo restores the confirmed changes.",
            }
          : {}),
      };
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
      const cached = await observe({
        ...draft,
        ...(command.messageId ? { replyToMessageId: command.messageId } : {}),
        draftMode: command.mode,
      });
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
    if (command.action === "removeAttachment") {
      const current = await mailbox.message(command.id);
      if (!current.draft || current.changeKey !== command.changeKey)
        throw new Error(
          "This draft changed. Review it before removing an attachment.",
        );
      const claim = await db.rpc("email_claim_draft", {
        p_message_id: command.id,
        p_change_key: command.changeKey,
        p_staff_id: staff.id,
        p_token: command.editToken,
      });
      if (claim.error) throw claim.error;
      if (claimSchema.parse(claim.data).state !== "ready")
        throw new Error("This draft is scheduled, sending or being edited.");
      try {
        await mailbox.removeAttachment(command.id, command.attachmentId);
        return {
          state: "saved",
          message: await observe(await mailbox.message(command.id)),
        };
      } finally {
        await db
          .from("email_draft_edits")
          .update({ writing_until: null })
          .eq("message_id", command.id)
          .eq("token", command.editToken);
      }
    }
    if (command.action === "discard") {
      const current = await mailbox.message(command.id);
      if (!current.draft || current.changeKey !== command.changeKey)
        throw new Error(
          "This draft changed in Outlook. Review it before deleting.",
        );
      const claimed = await db.rpc("email_claim_draft", {
        p_message_id: command.id,
        p_change_key: command.changeKey,
        p_staff_id: staff.id,
        p_token: command.editToken,
      });
      if (claimed.error) throw claimed.error;
      if (claimSchema.parse(claimed.data).state !== "ready")
        throw new Error(
          "This draft is scheduled, sending or being edited. Review its conversation first.",
        );
      try {
        const after = await mailbox.move(command.id, "deleteditems");
        await observe(after);
        const undoIds = await rememberMailUndo(db, staff.id, {
          kind: "move",
          messages:
            after.changeKey && current.folderId
              ? [
                  {
                    id: after.id,
                    changeKey: after.changeKey,
                    folderId: current.folderId,
                  },
                ]
              : [],
        });
        return { state: "discarded", undoIds };
      } finally {
        const released = await db
          .from("email_draft_edits")
          .update({ writing_until: null })
          .eq("message_id", command.id);
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
    if (command.action === "schedule" || command.undoDelaySeconds) {
      const scheduledAt =
        command.action === "schedule"
          ? command.scheduledAt
          : new Date(
              Date.now() + command.undoDelaySeconds! * 1000,
            ).toISOString();
      const result = await db.rpc("email_schedule_send", {
        p_message_id: command.id,
        p_change_key: command.changeKey,
        p_staff_id: staff.id,
        p_command_id: command.commandId,
        p_scheduled_at: scheduledAt,
      });
      if (result.error) throw result.error;
      const scheduled = claimSchema.parse(result.data);
      return {
        ...scheduled,
        ...(scheduled.state === "scheduled"
          ? {
              state: command.action === "send" ? "queued" : "scheduled",
              commandId: command.commandId,
              scheduledAt,
            }
          : {}),
      };
    }
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

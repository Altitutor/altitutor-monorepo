import { toast } from "sonner";
import { z } from "zod";
import type { EmailCommand } from "../types";
const resultSchema = z.object({
  state: z.string().optional(),
  undoIds: z.array(z.string()).optional(),
  commandId: z.string().optional(),
  scheduledAt: z.string().optional(),
  error: z.string().optional(),
});
/** Presentation of confirmed outcomes; the server owns all undo preconditions. */
export function emailCommandFeedback(
  command: EmailCommand,
  value: unknown,
  execute: (command: EmailCommand) => Promise<unknown>,
  refresh: () => void,
) {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return;
  const result = parsed.data;
  if (
    (result.state === "queued" || result.state === "scheduled") &&
    result.commandId &&
    result.scheduledAt
  ) {
    const id = result.commandId;
    const remaining = Math.max(
      0,
      new Date(result.scheduledAt).getTime() - Date.now(),
    );
    let cancelled = false;
    // Fast path while this client is open. The durable cron worker is the fallback.
    const timer =
      result.state === "queued"
        ? setTimeout(() => {
            if (!cancelled)
              void execute({ action: "dispatchQueued", id })
                .then(refresh)
                .catch(() => {
                  toast.message("Email remains queued", {
                    description:
                      "The background worker will reconcile delivery. Check the conversation before sending another copy.",
                  });
                });
          }, remaining + 100)
        : undefined;
    toast.success(
      result.state === "queued" ? "Sending in 10 seconds" : "Email scheduled",
      {
        description:
          result.state === "scheduled"
            ? new Date(result.scheduledAt).toLocaleString("en-AU")
            : undefined,
        duration: result.state === "queued" ? remaining : 10_000,
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            void execute({ action: "cancelSchedule", id })
              .then(() => {
                refresh();
                toast.success("Email returned to Drafts");
              })
              .catch((error: unknown) => {
                refresh();
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Undo could not be confirmed. Review the conversation.",
                );
              });
          },
        },
      },
    );
    return;
  }
  const labels: Partial<Record<EmailCommand["action"], string>> = {
    read:
      command.action === "read" && command.read
        ? "Marked as read"
        : "Marked as unread",
    move:
      command.action === "move" && command.folderId === "deleteditems"
        ? "Email moved to Deleted Items"
        : "Email moved",
    assign: "Responsibility updated",
    discard: "Draft moved to Deleted Items",
    cancelSchedule: "Email returned to Drafts",
    link: "Contact linked",
  };
  if (command.action === "read" && command.silent) return;
  const label = labels[command.action];
  if (!label) return;
  const undoIds = result.undoIds;
  toast[result.state === "partial" ? "warning" : "success"](
    result.state === "partial" ? "Some emails could not be changed" : label,
    {
      description: result.error,
      ...(undoIds?.length
        ? {
            duration: 10_000,
            action: {
              label: "Undo",
              onClick: () => {
                void execute({ action: "undo", ids: [...undoIds].reverse() })
                  .then(() => {
                    refresh();
                    toast.success("Action undone");
                  })
                  .catch((error: unknown) => {
                    refresh();
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Undo could not be confirmed. Refresh to review.",
                    );
                  });
              },
            },
          }
        : {}),
    },
  );
}

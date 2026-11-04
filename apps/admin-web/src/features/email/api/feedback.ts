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
    let countdown: ReturnType<typeof setInterval> | undefined;
    // Fast path while this client is open. The durable cron worker is the fallback.
    const timer =
      result.state === "queued"
        ? setTimeout(() => {
            if (!cancelled)
              void execute({ action: "dispatchQueued", id })
                .then(() => {
                  if (countdown) clearInterval(countdown);
                  toast.dismiss(id);
                  refresh();
                })
                .catch(() => {
                  if (countdown) clearInterval(countdown);
                  toast.dismiss(id);
                  toast.message("Email remains queued", {
                    description:
                      "The background worker will reconcile delivery. Check the conversation before sending another copy.",
                  });
                });
          }, remaining + 100)
        : undefined;
    const stopCountdown = () => {
      if (countdown) clearInterval(countdown);
    };
    const undo = {
      label: "Undo",
      onClick: () => {
        cancelled = true;
        stopCountdown();
        if (timer) clearTimeout(timer);
        toast.dismiss(id);
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
        };
    const toastId = toast.success(
      result.state === "queued"
        ? `Sending in ${Math.max(1, Math.ceil(remaining / 1000))} seconds`
        : "Email scheduled",
      {
        id,
        description:
          result.state === "scheduled"
            ? new Date(result.scheduledAt).toLocaleString("en-AU")
            : undefined,
        duration: result.state === "queued" ? Infinity : 10_000,
        onDismiss: stopCountdown,
        action: undo,
      },
    );
    if (result.state === "queued") {
      countdown = setInterval(() => {
        const seconds = Math.ceil(
          (new Date(result.scheduledAt!).getTime() - Date.now()) / 1000,
        );
        if (seconds <= 0) {
          stopCountdown();
          toast.dismiss(toastId);
          return;
        }
        toast.success(`Sending in ${seconds} second${seconds === 1 ? "" : "s"}`, {
          id: toastId,
          duration: Infinity,
          onDismiss: stopCountdown,
          action: undo,
        });
      }, 1000);
    }
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

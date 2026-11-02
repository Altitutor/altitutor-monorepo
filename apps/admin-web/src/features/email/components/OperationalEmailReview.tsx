"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { mailRequest, useSyncMailbox } from "../api/client";
import { useOpenEmailThread } from "../hooks/useOpenEmailThread";
export function OperationalEmailReview({ onClose }: { onClose: () => void }) {
  const open = useOpenEmailThread();
  const sync = useSyncMailbox();
  const operations = useQuery({
    queryKey: ["email", "operations"],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            state: z.string(),
            subject: z.string(),
            to: z.array(z.string()),
            threadId: z.string().nullable(),
            updatedAt: z.string(),
          }),
        )
        .parse(await mailRequest("/operations")),
  });
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="Operational email outcomes"
      subtitle="Microsoft Sent Items confirms completed submission. An unresolved send is never submitted again automatically."
      fillHeight
      headerActions={
        <Button
          variant="outline"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          Check Microsoft
        </Button>
      }
    >
      <div className="space-y-3">
        {operations.isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading email outcomes…
          </p>
        )}
        {operations.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No operational emails are awaiting confirmation or review.
          </p>
        )}
        {operations.data?.map((operation) => (
          <article
            key={operation.id}
            className="space-y-2 rounded-md border p-3"
          >
            <p className="text-sm font-medium">{operation.subject}</p>
            <p className="text-xs text-muted-foreground">
              {operation.to.join(", ")}
            </p>
            <p className="text-xs">
              {operation.state === "submitted"
                ? "Submitted · awaiting Microsoft confirmation"
                : operation.state === "failed"
                  ? "The request failed before submission. Retry the original action after correcting the cause."
                  : "Outcome unresolved · inspect the existing shared draft or Sent mail before taking further action"}
            </p>
            {operation.threadId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  open(operation.threadId!, operation.subject);
                  onClose();
                }}
              >
                Open email conversation
              </Button>
            )}
          </article>
        ))}
        {(operations.error || sync.error) && (
          <p role="alert" className="text-xs text-destructive">
            {operations.error?.message ?? sync.error?.message}
          </p>
        )}
      </div>
    </AdminDialogShell>
  );
}

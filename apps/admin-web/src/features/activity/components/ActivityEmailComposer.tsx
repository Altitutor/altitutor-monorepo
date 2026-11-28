"use client";

import { useState } from "react";
import { Button } from "@altitutor/ui";
import { useMailbox } from "@/features/email/api/client";
import { NewEmailComposer } from "@/features/email/components/NewEmailComposer";

export function ActivityEmailComposer({
  visible,
  recipient,
}: {
  visible: boolean;
  recipient?: string;
}) {
  const [open, setOpen] = useState(false);
  const mailbox = useMailbox({}, open);

  if (!visible && !open) return null;

  return (
    <>
      {visible && (
        <div className="flex shrink-0 justify-end border-t bg-background p-3">
          {open && mailbox.error ? (
            <div className="flex items-center gap-2">
              <p role="alert">{mailbox.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => void mailbox.refetch()}>Retry</Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          ) : (
            <Button onClick={() => setOpen(true)} disabled={open}>
              {open && !mailbox.data ? "Loading email composer…" : "Create email"}
            </Button>
          )}
        </div>
      )}
      {open && mailbox.data && (
        <NewEmailComposer
          mailbox={mailbox.data}
          recipient={recipient}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

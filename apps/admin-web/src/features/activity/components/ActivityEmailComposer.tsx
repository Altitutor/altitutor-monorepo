"use client";

import { useId, useState } from "react";
import { Button } from "@altitutor/ui";
import { useEmailCommand, useMailbox } from "@/features/email/api/client";
import { EmailComposer } from "@/features/email/components/EmailComposer";
import { draftResponseSchema } from "@/features/email/types";

export function ActivityEmailComposer({
  visible,
  recipient,
}: {
  visible: boolean;
  recipient?: string;
}) {
  const id = useId();
  const mailbox = useMailbox({}, visible);
  const command = useEmailCommand();
  const [revision, setRevision] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);

  if (!visible && !hasDraft) return null;

  return (
    <div hidden={!visible} className="max-h-[65%] shrink-0 overflow-y-auto border-t bg-background">
      {mailbox.data ? (
        <EmailComposer
          key={revision}
          draft={{
            id: `local:activity:${id}:${revision}`,
            threadId: "",
            sender: mailbox.data.mailboxAddress,
            subject: "",
            bodyText: "",
            to: recipient ? [recipient] : [],
            cc: [],
            bcc: [],
            draft: true,
            draftMode: "new",
            removed: false,
          }}
          mailbox={mailbox.data}
          signature={mailbox.data.signature}
          disabledReason={mailbox.data.configured ? undefined : "Connect the Microsoft mailbox to compose email."}
          prepareDraft={async () => {
            setHasDraft(true);
            return draftResponseSchema.parse(
              await command.mutateAsync({ action: "draft", mode: "new" }),
            );
          }}
          inline
          onClose={() => {
            setHasDraft(false);
            setRevision((current) => current + 1);
          }}
        />
      ) : visible ? (
        <div className="flex flex-wrap items-center gap-2 p-3 text-sm text-muted-foreground">
          {mailbox.error ? (
            <>
              <p role="alert">{mailbox.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => void mailbox.refetch()}>Retry</Button>
            </>
          ) : "Loading email composer…"}
        </div>
      ) : null}
    </div>
  );
}

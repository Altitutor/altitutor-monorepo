"use client";

import { useId } from "react";
import { useEmailCommand } from "../api/client";
import { draftResponseSchema, type MailboxData } from "../types";
import { EmailComposer, type RegisterDraftClose } from "./EmailComposer";

export function NewEmailComposer({
  mailbox,
  onClose,
  recipient,
  registerForClose,
}: {
  mailbox: MailboxData;
  onClose: () => void;
  recipient?: string;
  registerForClose?: RegisterDraftClose;
}) {
  const id = useId();
  const command = useEmailCommand();

  return (
    <EmailComposer
      dialogTitle="New email"
      draft={{
        id: `local:compose:${id}`,
        threadId: "",
        sender: mailbox.mailboxAddress,
        subject: "",
        bodyText: "",
        to: recipient ? [recipient] : [],
        cc: [],
        bcc: [],
        draft: true,
        draftMode: "new",
        removed: false,
      }}
      mailbox={mailbox}
      signature={mailbox.signature}
      disabledReason={mailbox.configured ? undefined : "Connect the Microsoft mailbox to compose email."}
      prepareDraft={async () => draftResponseSchema.parse(
        await command.mutateAsync({ action: "draft", mode: "new" }),
      )}
      registerForClose={registerForClose}
      onClose={onClose}
    />
  );
}

"use client";
import { useState } from "react";
import { Button, SearchableSelect } from "@altitutor/ui";
import { Mail } from "lucide-react";
import { useMailbox, useEmailCommand } from "../api/client";
import { draftResponseSchema, type EmailMessage } from "../types";
import { EmailComposer } from "./EmailComposer";
import { useOpenEmailThread } from "../hooks/useOpenEmailThread";

type Person = {
  id: string;
  first_name: string | null;
  last_name?: string | null;
  email?: string | null;
};
/** Domain screens supply their canonical text; the shared mailbox owns the draft and send. */
export function WorkflowEmail({
  student,
  parents,
  subject,
  buildBody,
  sessionIds = [],
}: {
  student: Person;
  parents: Person[];
  subject: string;
  buildBody: (recipientName: string) => Promise<string>;
  sessionIds?: string[];
}) {
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailMessage | null>(null);
  const [initialBody, setInitialBody] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mailbox = useMailbox();
  const command = useEmailCommand();
  const openThread = useOpenEmailThread();
  const recipients = [
    { ...student, type: "student" as const },
    ...parents.map((parent) => ({ ...parent, type: "parent" as const })),
  ].filter((person) => person.email);
  const recipient =
    recipients.find(
      (person) => `${person.type}:${person.id}` === recipientId,
    ) ?? recipients[0];
  async function prepare() {
    if (!recipient || busy) return;
    setBusy(true);
    setError("");
    try {
      const body =
        initialBody ?? (await buildBody(recipient.first_name || "there"));
      setInitialBody(body);
      let current = draft;
      if (!current) {
        const result = draftResponseSchema.parse(
          await command.mutateAsync({ action: "draft", mode: "new" }),
        );
        if (!result.message)
          throw new Error("Microsoft did not return a shared draft.");
        current = result.message;
        setDraft(current);
      }
      await command.mutateAsync({
        action: "link",
        threadId: current.threadId,
        recordType: "student",
        recordId: student.id,
      });
      if (recipient.type === "parent")
        await command.mutateAsync({
          action: "link",
          threadId: current.threadId,
          recordType: "parent",
          recordId: recipient.id,
        });
      for (const id of sessionIds)
        await command.mutateAsync({
          action: "link",
          threadId: current.threadId,
          recordType: "session",
          recordId: id,
        });
      setReady(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not prepare the shared email draft.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="mb-4 space-y-2 rounded-md border p-3"
      aria-label="Email confirmation"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="h-4 w-4" />
        <span className="text-sm font-medium">Send confirmation by email</span>
        <SearchableSelect
          items={recipients}
          value={recipient ?? null}
          disabled={Boolean(draft) || busy}
          onValueChange={(person) =>
            setRecipientId(person ? `${person.type}:${person.id}` : null)
          }
          getItemId={(person) => `${person.type}:${person.id}`}
          getItemLabel={(person) =>
            `${[person.first_name, person.last_name].filter(Boolean).join(" ")} · ${person.email}`
          }
          searchPlaceholder="Search email recipients…"
          placeholder="No email address available"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!recipient || busy || !mailbox.data?.configured}
          onClick={() => {
            if (ready && draft) openThread(draft.threadId, subject);
            else void prepare();
          }}
        >
          {busy
            ? "Preparing…"
            : ready
              ? "Open shared draft"
              : draft
                ? "Retry preparing draft"
                : "Prepare email"}
        </Button>
      </div>
      {!recipients.length && (
        <p className="text-xs text-muted-foreground">
          Add an email address to the Student or Parent to send an email.
        </p>
      )}
      {mailbox.data && !mailbox.data.configured && (
        <p className="text-xs text-muted-foreground">
          The Microsoft mailbox connection is not configured.
        </p>
      )}
      {(error || mailbox.error) && (
        <p role="alert" className="text-xs text-destructive">
          {error || mailbox.error?.message}
        </p>
      )}
      {ready && draft && mailbox.data && (
        <EmailComposer
          key={draft.id}
          draft={draft}
          mailbox={mailbox.data}
          initialContent={{
            subject,
            bodyText: initialBody ?? "",
            to: [recipient?.email ?? ""],
          }}
          onClose={() => {
            setReady(false);
            setDraft(null);
            setInitialBody(null);
          }}
        />
      )}
    </section>
  );
}

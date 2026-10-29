"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button, Input, SearchableSelect, Textarea } from "@altitutor/ui";
import { FileText, Paperclip } from "lucide-react";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { EmailSettingsDialog } from "./EmailSettingsDialog";
import { useEmailCommand } from "../api/client";
import {
  draftResponseSchema,
  type EmailMessage,
  type MailboxData,
} from "../types";
const addresses = (value: string) =>
  value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
type Content = {
  subject: string;
  bodyText: string;
  to: string;
  cc: string;
  bcc: string;
};
export function EmailComposer({
  draft,
  mailbox,
  inline = false,
  signature,
  initialContent,
  onClose,
}: {
  draft: EmailMessage;
  mailbox: MailboxData;
  inline?: boolean;
  signature?: string;
  initialContent?: { subject: string; bodyText: string; to: string[] };
  onClose: () => void;
}) {
  const command = useEmailCommand();
  const scope = useAccessoryTab();
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null);
  const [saveRevision, setSaveRevision] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState(draft);
  const [content, setContent] = useState<Content>(() => ({
    subject: initialContent?.subject ?? draft.subject,
    bodyText:
      initialContent?.bodyText ??
      (signature
        ? `\n\n${signature}${draft.bodyText ? `\n\n${draft.bodyText}` : ""}`
        : draft.bodyText),
    to: (initialContent?.to ?? draft.to).join(", "),
    cc: draft.cc.join(", "),
    bcc: draft.bcc.join(", "),
  }));
  const [dirty, setDirty] = useState(Boolean(signature || initialContent));
  const [status, setStatus] = useState("Shared draft in Microsoft");
  const [conflict, setConflict] = useState<EmailMessage | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [recovery, setRecovery] = useState<Content | null>(null);
  const editToken = useRef<string | null>(null);
  const busy = useRef(false);
  const current = useRef(content);
  current.current = content;
  const version = useRef(message.changeKey ?? "");
  const upload = useRef<HTMLInputElement>(null);
  const recoveryKey = `email-draft-recovery:${mailbox.currentStaffId}:${draft.id}`;
  useEffect(() => {
    editToken.current = crypto.randomUUID();
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(recoveryKey) ?? "null",
      );
      const parsed = z
        .object({
          subject: z.string(),
          bodyText: z.string(),
          to: z.string(),
          cc: z.string(),
          bcc: z.string(),
        })
        .safeParse(value);
      if (parsed.success) setRecovery(parsed.data);
    } catch {
      /* A blocked store does not prevent shared drafts. */
    }
  }, [recoveryKey]);
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(recoveryKey, JSON.stringify(content));
    } catch {
      /* Text remains available in this editor. */
    }
  }, [content, dirty, recoveryKey]);
  async function save() {
    if (busy.current || blocked || conflict) return false;
    const snapshot = current.current;
    if (
      ![
        ...addresses(snapshot.to),
        ...addresses(snapshot.cc),
        ...addresses(snapshot.bcc),
      ].every((address) => z.string().email().safeParse(address).success)
    ) {
      setStatus("Enter valid email recipients to save this draft.");
      return false;
    }
    busy.current = true;
    setStatus("Saving shared draft…");
    try {
      const result = draftResponseSchema.parse(
        await command.mutateAsync({
          action: "save",
          id: draft.id,
          editToken: (editToken.current ??= crypto.randomUUID()),
          content: {
            expectedChangeKey: version.current,
            subject: snapshot.subject,
            bodyText: snapshot.bodyText,
            to: addresses(snapshot.to),
            cc: addresses(snapshot.cc),
            bcc: addresses(snapshot.bcc),
          },
        }),
      );
      if (result.state === "conflict") {
        setConflict(result.message ?? null);
        setStatus(
          "This draft changed in another client. Your text is preserved here.",
        );
        return false;
      }
      if (result.state !== "saved" || !result.message) {
        setStatus(
          result.state === "busy"
            ? "Another portal editor is working on this draft. Retry saving shortly."
            : "This draft has an unresolved send. Refresh its conversation.",
        );
        return false;
      }
      version.current = result.message.changeKey ?? "";
      setMessage(result.message);
      const unchanged =
        JSON.stringify(snapshot) === JSON.stringify(current.current);
      if (unchanged) {
        setDirty(false);
        try {
          localStorage.removeItem(recoveryKey);
        } catch {
          /* Optional recovery store. */
        }
      }
      if (!unchanged) setSaveRevision((value) => value + 1);
      setStatus("Saved to Microsoft · shared draft");
      return unchanged;
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Draft save failed. Your text is preserved here.",
      );
      return false;
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (!dirty || conflict || blocked) return;
    const timer = setTimeout(() => {
      void save();
    }, 1000);
    return () => clearTimeout(timer);
    // Each text revision schedules a save; the live ref serializes writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dirty, conflict, blocked, saveRevision]);
  async function send() {
    if (sending || blocked || !addresses(current.current.to).length) return;
    setSending(true);
    try {
      if (dirty && !(await save())) return;
      setBlocked(true);
      setStatus("Submitting to Microsoft…");
      const result = draftResponseSchema.parse(
        await command.mutateAsync({
          action: "send",
          id: draft.id,
          changeKey: version.current,
          commandId: crypto.randomUUID(),
        }),
      );
      if (result.state === "submitted") {
        try {
          localStorage.removeItem(recoveryKey);
        } catch {
          /* Optional recovery store. */
        }
        setDirty(false);
        setStatus(
          "Submitted to Microsoft. Sent Items will confirm the result.",
        );
      } else if (result.state === "failed") {
        setBlocked(false);
        setStatus(
          "Microsoft rejected this submission. The draft is preserved; correct the issue before sending again.",
        );
      } else if (result.state === "conflict" || result.state === "busy") {
        setBlocked(false);
        setConflict(result.message ?? null);
        setStatus(
          "The shared draft changed or is being edited. Review it before sending.",
        );
      } else
        setStatus(
          "Send outcome is unresolved. Refresh the conversation; do not submit another copy.",
        );
    } catch {
      setBlocked(true);
      setStatus(
        "Send outcome could not be confirmed. Refresh the conversation; do not submit another copy.",
      );
    } finally {
      setSending(false);
    }
  }
  function patch(values: Partial<Content>) {
    setContent((all) => ({ ...all, ...values }));
    setDirty(true);
  }
  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <SearchableSelect
          items={mailbox.templates}
          value={null}
          onValueChange={(template) => {
            if (template)
              patch({
                bodyText:
                  template.body_text + (signature ? `\n\n${signature}` : ""),
                ...(template.subject ? { subject: template.subject } : {}),
              });
          }}
          getItemId={(template) => template.id}
          getItemLabel={(template) => template.name}
          searchPlaceholder="Search email templates…"
          footer={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              Manage templates and signature
            </Button>
          }
          trigger={
            <Button
              variant="outline"
              size="icon"
              aria-label="Insert email template"
              disabled={blocked}
            >
              <FileText className="h-4 w-4" />
            </Button>
          }
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Attach email file"
          disabled={blocked || dirty || command.isPending}
          onClick={() => upload.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <span className="max-w-48 truncate text-xs text-muted-foreground">
          Altitutor Admin · admin@altitutor.com
        </span>
      </div>
      <Button
        disabled={
          blocked ||
          sending ||
          command.isPending ||
          !content.bodyText.trim() ||
          !addresses(content.to).length
        }
        onClick={() => void send()}
      >
        Send
      </Button>
    </div>
  );
  const editor = (
    <div className="space-y-3">
      {recovery && (
        <div className="rounded-md bg-muted p-3 text-xs">
          Unsaved text is available from this browser.{" "}
          <Button
            size="sm"
            variant="link"
            onClick={() => {
              setContent(recovery);
              setRecovery(null);
              setDirty(true);
            }}
          >
            Recover text
          </Button>
          <Button
            size="sm"
            variant="link"
            onClick={() => {
              setRecovery(null);
              try {
                localStorage.removeItem(recoveryKey);
              } catch {
                /* Optional recovery store. */
              }
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
      <label className="block text-xs">
        To
        <Input
          aria-label="Email recipients"
          value={content.to}
          disabled={blocked}
          onChange={(event) => patch({ to: event.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          Cc
          <Input
            value={content.cc}
            disabled={blocked}
            onChange={(event) => patch({ cc: event.target.value })}
          />
        </label>
        <label className="text-xs">
          Bcc
          <Input
            value={content.bcc}
            disabled={blocked}
            onChange={(event) => patch({ bcc: event.target.value })}
          />
        </label>
      </div>
      <label className="block text-xs">
        Subject
        <Input
          aria-label="Email subject"
          value={content.subject}
          disabled={blocked}
          onChange={(event) => patch({ subject: event.target.value })}
        />
      </label>
      <Textarea
        aria-label="Email body"
        placeholder="Write a reply…"
        className="min-h-40 resize-y"
        value={content.bodyText}
        disabled={blocked}
        onChange={(event) => patch({ bodyText: event.target.value })}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
      />
      <input
        type="file"
        ref={upload}
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size >= 3_000_000) {
            setStatus(
              "Files of 3 MB or more require a large-file upload session, which is not available yet.",
            );
            return;
          }
          setStatus("Attaching file…");
          try {
            const body = new FormData();
            body.set("id", draft.id);
            body.set("changeKey", version.current);
            body.set("editToken", (editToken.current ??= crypto.randomUUID()));
            body.set("file", file);
            const response = await fetch("/api/email/attachments", {
              method: "POST",
              body,
            });
            const value: unknown = await response.json();
            if (!response.ok)
              throw new Error(
                z.object({ error: z.string() }).parse(value).error,
              );
            const result = draftResponseSchema.parse(value);
            if (result.message) {
              setMessage(result.message);
              version.current = result.message.changeKey ?? "";
            }
            setStatus(`Attached ${file.name}`);
          } catch (error) {
            setStatus(
              error instanceof Error ? error.message : "Attachment failed.",
            );
          }
        }}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <p role="status">{status}</p>
        {dirty && !blocked && (
          <Button
            variant="ghost"
            size="sm"
            disabled={command.isPending}
            onClick={() => void save()}
          >
            Save draft
          </Button>
        )}
      </div>
      {conflict && (
        <div className="rounded-md border p-3 text-xs">
          <p className="font-medium">Latest Microsoft draft</p>
          <p className="mt-2 whitespace-pre-wrap">{conflict.bodyText}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!conflict.draft}
              onClick={() => {
                version.current = conflict.changeKey ?? "";
                setMessage(conflict);
                setConflict(null);
                setDirty(true);
              }}
            >
              Keep my text and save against this version
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                version.current = conflict.changeKey ?? "";
                setMessage(conflict);
                setContent({
                  subject: conflict.subject,
                  bodyText: conflict.bodyText,
                  to: conflict.to.join(", "),
                  cc: conflict.cc.join(", "),
                  bcc: conflict.bcc.join(", "),
                });
                setConflict(null);
                setDirty(false);
                setBlocked(!conflict.draft);
              }}
            >
              Use Microsoft version
            </Button>
          </div>
        </div>
      )}
    </div>
  );
  useEffect(() => {
    if (!inline || !scope) return;
    scope.registerClose((next) => {
      if (dirty || sending) setPendingClose(() => next ?? scope.close);
      else (next ?? scope.close)();
    });
    return () => scope.registerClose(null);
  }, [scope, inline, dirty, sending]);
  function close() {
    if (dirty || sending) setPendingClose(() => onClose);
    else onClose();
  }
  const confirmation = (
    <AdminDialogShell
      open={Boolean(pendingClose)}
      onClose={() => setPendingClose(null)}
      title="Close email editor?"
      subtitle="The last saved draft stays in Microsoft. Unsaved text remains recoverable in this browser."
      footer={
        <>
          <Button variant="outline" onClick={() => setPendingClose(null)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              const next = pendingClose;
              setPendingClose(null);
              next?.();
            }}
          >
            Close editor
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        You can recover unsaved text when reopening this draft in this browser.
      </p>
    </AdminDialogShell>
  );
  return (
    <>
      {inline ? (
        <section
          className="space-y-3 border-t p-3"
          aria-label="Shared email draft"
        >
          {editor}
          <div className="border-t pt-2">{footer}</div>
          <Button variant="ghost" size="sm" onClick={close}>
            Close editor
          </Button>
        </section>
      ) : (
        <AdminDialogShell
          open
          onClose={close}
          title="Compose email"
          subtitle="Shared Microsoft draft"
          fillHeight
          footer={footer}
        >
          {editor}
        </AdminDialogShell>
      )}
      {confirmation}
      {settingsOpen && (
        <EmailSettingsDialog
          mailbox={mailbox}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

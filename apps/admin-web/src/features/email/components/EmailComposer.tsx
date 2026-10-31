"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Button,
  Input,
  SearchableSelect,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DateTimePickerPopover,
  Badge,
} from "@altitutor/ui";
import {
  FileText,
  Paperclip,
  Clock,
  ArrowUp,
  X,
  Save,
  Trash2,
} from "lucide-react";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import Link from "next/link";
import { EmailActionGroup } from "./EmailActions";
import type { Editor } from "@tiptap/core";
import { toast } from "sonner";
import {
  EmailBodyEditor,
  EmailFormatting,
  textHtml,
  signatureHtml,
} from "./EmailBodyEditor";
import { EmailIconButton } from "./EmailIconButton";
import { EmailRecipients } from "./EmailRecipients";
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
  bodyHtml?: string;
  to: string;
  cc: string;
  bcc: string;
};
export function EmailComposer({
  draft,
  mailbox,
  signature,
  initialContent,
  onClose,
  draftReady,
  onSubjectChange,
}: {
  draft: EmailMessage;
  mailbox: MailboxData;
  inline?: boolean;
  signature?: string;
  initialContent?: { subject: string; bodyText: string; to: string[] };
  onClose: () => void;
  onSubjectChange?: (subject: string) => void;
  draftReady?: Promise<{ message?: EmailMessage }>;
}) {
  const command = useEmailCommand();
  const [richEditor, setRichEditor] = useState<Editor | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [pendingRecipients, setPendingRecipients] = useState({
    to: false,
    cc: false,
    bcc: false,
  });
  const [showCc, setShowCc] = useState(Boolean(draft.cc.length));
  const [showBcc, setShowBcc] = useState(Boolean(draft.bcc.length));
  const provider = useRef(draft);
  const [preparing, setPreparing] = useState(Boolean(draftReady));
  const [creationError, setCreationError] = useState("");
  const scope = useAccessoryTab();
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null);
  const [saveRevision, setSaveRevision] = useState(0);
  const [message, setMessage] = useState(draft);
  const [content, setContent] = useState<Content>(() => ({
    subject: initialContent?.subject ?? draft.subject,
    bodyText:
      initialContent?.bodyText ??
      (signature
        ? `\n\n${signature}${draft.bodyText ? `\n\n${draft.bodyText}` : ""}`
        : draft.bodyText),
    bodyHtml: initialContent
      ? textHtml(initialContent.bodyText)
      : signature
        ? `<p><br></p>${signatureHtml(signature)}${draft.bodyHtml ?? textHtml(draft.bodyText)}`
        : (draft.bodyHtml ?? textHtml(draft.bodyText)),
    to: (initialContent?.to ?? draft.to).join(", "),
    cc: draft.cc.join(", "),
    bcc: draft.bcc.join(", "),
  }));
  const initialEditorContent = useRef(content);
  const [dirty, setDirty] = useState(Boolean(signature || initialContent));
  const [status, setStatus] = useState(
    draftReady
      ? "Preparing Microsoft draft… You can keep typing."
      : "Shared draft in Microsoft",
  );
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
  const recoveryRead = useRef(false);
  const [recoveryKey, setRecoveryKey] = useState(
    `email-draft-recovery:${mailbox.currentStaffId}:${draft.id}`,
  );
  useEffect(() => {
    if (!draftReady) return;
    let alive = true;
    void draftReady
      .then((result) => {
        if (!alive) return;
        if (!result.message)
          throw new Error("Could not create Microsoft draft.");
        provider.current = result.message;
        const prepared = result.message;
        // Graph owns Reply-To/Reply-All semantics. Adopt its envelope only in
        // fields the user has not deliberately changed during preparation.
        setContent((all) => ({
          ...all,
          subject:
            all.subject === initialEditorContent.current.subject
              ? prepared.subject
              : all.subject,
          to:
            all.to === initialEditorContent.current.to
              ? prepared.to.join(", ")
              : all.to,
          cc:
            all.cc === initialEditorContent.current.cc
              ? prepared.cc.join(", ")
              : all.cc,
          bcc:
            all.bcc === initialEditorContent.current.bcc
              ? prepared.bcc.join(", ")
              : all.bcc,
        }));
        if (prepared.cc.length) setShowCc(true);
        if (prepared.bcc.length) setShowBcc(true);
        const providerRecoveryKey = `email-draft-recovery:${mailbox.currentStaffId}:${result.message.id}`;
        try {
          localStorage.setItem(
            providerRecoveryKey,
            JSON.stringify(current.current),
          );
          localStorage.removeItem(recoveryKey);
        } catch {
          /* Recovery is optional; text stays in the mounted editor. */
        }
        setRecoveryKey(providerRecoveryKey);
        version.current = result.message.changeKey ?? "";
        setMessage(result.message);
        setPreparing(false);
        setStatus("Shared draft in Microsoft");
      })
      .catch(() => {
        if (alive) {
          setPreparing(false);
          setCreationError(
            "Could not create the Microsoft draft. Your text is kept here; close only after copying it or retry by reopening Compose.",
          );
        }
      });
    return () => {
      alive = false;
    };
    // A preparation belongs to this mounted draft; recovery-key promotion must
    // not re-run its completion and clear the editor's recovery snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady]);
  useEffect(() => {
    if (recoveryRead.current) return;
    recoveryRead.current = true;
    editToken.current = crypto.randomUUID();
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(recoveryKey) ?? "null",
      );
      const parsed = z
        .object({
          subject: z.string(),
          bodyText: z.string(),
          bodyHtml: z.string().optional(),
          to: z.string(),
          cc: z.string(),
          bcc: z.string(),
        })
        .safeParse(value);
      if (parsed.success) setRecovery(parsed.data);
    } catch {
      /* A blocked store does not prevent shared drafts. */
    }
    // Read recovery once for the draft that was opened. Provider-ID promotion is our own write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(recoveryKey, JSON.stringify(content));
    } catch {
      /* Text remains available in this editor. */
    }
  }, [content, dirty, recoveryKey]);
  async function save() {
    if (busy.current || blocked || conflict || preparing || creationError)
      return false;
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
          id: provider.current.id,
          editToken: (editToken.current ??= crypto.randomUUID()),
          content: {
            expectedChangeKey: version.current,
            subject: snapshot.subject,
            bodyText: snapshot.bodyText,
            bodyHtml: snapshot.bodyHtml,
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
      // An edit made while the provider was busy must get its own save,
      // including when the earlier request failed (e.g. an incomplete address).
      if (JSON.stringify(snapshot) !== JSON.stringify(current.current))
        setSaveRevision((value) => value + 1);
    }
  }
  useEffect(() => {
    if (!dirty || conflict || blocked || preparing || creationError) return;
    const timer = setTimeout(() => {
      void save();
    }, 1000);
    return () => clearTimeout(timer);
    // Each text revision schedules a save; the live ref serializes writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    content,
    dirty,
    conflict,
    blocked,
    saveRevision,
    preparing,
    creationError,
  ]);
  async function send(at = scheduledAt ?? undefined) {
    if (
      sending ||
      blocked ||
      Object.values(pendingRecipients).some(Boolean) ||
      !addresses(current.current.to).length ||
      (at !== undefined &&
        (!Number.isFinite(new Date(at).getTime()) ||
          new Date(at).getTime() <= Date.now()))
    )
      return;
    setSending(true);
    try {
      if (dirty && !(await save())) return;
      setBlocked(true);
      setStatus("Submitting to Microsoft…");
      const result = draftResponseSchema.parse(
        await command.mutateAsync({
          ...(at
            ? { action: "schedule" as const, scheduledAt: at }
            : { action: "send" as const }),
          id: provider.current.id,
          changeKey: version.current,
          commandId: crypto.randomUUID(),
        }),
      );
      if (result.state === "submitted" || result.state === "scheduled") {
        try {
          localStorage.removeItem(recoveryKey);
        } catch {
          /* Optional recovery store. */
        }
        setDirty(false);
        toast.success(
          result.state === "scheduled" ? "Email scheduled" : "Email submitted",
          {
            description:
              result.state === "scheduled"
                ? new Date(at!).toLocaleString("en-AU")
                : "Sent Items will confirm delivery in the conversation.",
          },
        );
        onClose();
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
    if (values.subject !== undefined) onSubjectChange?.(values.subject);
    setContent((all) => ({ ...all, ...values }));
    setDirty(true);
  }
  const unavailable =
    blocked ||
    sending ||
    command.isPending ||
    preparing ||
    Boolean(creationError);
  const footer = (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
        <EmailFormatting editor={richEditor} disabled={blocked || sending} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <EmailActionGroup label="Draft actions">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <SearchableSelect
                    items={mailbox.templates}
                    value={null}
                    onValueChange={(template) => {
                      if (template)
                        patch({
                          bodyText: template.body_text,
                          bodyHtml: `${signatureHtml(template.body_text)}${signature ? `<p><br></p>${signatureHtml(signature)}` : ""}`,
                          ...(template.subject
                            ? { subject: template.subject }
                            : {}),
                        });
                    }}
                    getItemId={(template) => template.id}
                    getItemLabel={(template) => template.name}
                    searchPlaceholder="Search email templates…"
                    footer={
                      <Link
                        href="/settings/email"
                        className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                      >
                        Manage templates and signature
                      </Link>
                    }
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        aria-label="Insert email template"
                        disabled={blocked}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    }
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>Insert email template</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <EmailIconButton
            label="Attach email file"
            disabled={unavailable}
            onClick={async () => {
              if (dirty && !(await save())) return;
              upload.current?.click();
            }}
          >
            <Paperclip className="h-4 w-4" />
          </EmailIconButton>
        </EmailActionGroup>
        <DateTimePickerPopover
          value={scheduledAt}
          onChange={setScheduledAt}
          label="Schedule email"
          minDate={new Date().toLocaleDateString("en-CA")}
        >
          <EmailIconButton
            className={`h-9 shrink-0 rounded-full ${scheduledAt ? "w-auto px-2.5" : "w-9"}`}
            label={
              scheduledAt
                ? `Scheduled time: ${new Date(scheduledAt).toLocaleString("en-AU")}`
                : "Schedule send"
            }
            disabled={blocked || sending}
          >
            <Clock className="h-4 w-4" />
            {scheduledAt && (
              <span className="ml-1.5 text-xs">
                {new Date(scheduledAt).toLocaleString("en-AU", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </EmailIconButton>
        </DateTimePickerPopover>
        <EmailIconButton
          label={scheduledAt ? "Schedule email" : "Send"}
          className="h-9 w-9 rounded-full"
          disabled={
            unavailable ||
            !content.bodyText.trim() ||
            !addresses(content.to).length ||
            Object.values(pendingRecipients).some(Boolean) ||
            (scheduledAt !== null &&
              new Date(scheduledAt).getTime() <= Date.now())
          }
          onClick={() => void send()}
        >
          <ArrowUp className="h-4 w-4" />
        </EmailIconButton>
      </div>
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
      <div className="space-y-2">
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
          <span className="text-muted-foreground">From</span>
          <span className="w-fit rounded-md bg-muted px-2 py-1 text-xs">
            Altitutor Admin · {mailbox.mailboxAddress}
          </span>
        </div>
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-2 text-sm">
          <span className="pt-2 text-muted-foreground">To</span>
          <EmailRecipients
            label="Email recipients"
            value={addresses(content.to)}
            onChange={(value) => patch({ to: value.join(", ") })}
            onPendingChange={(pending) =>
              setPendingRecipients((all) =>
                all.to === pending ? all : { ...all, to: pending },
              )
            }
            disabled={blocked}
            threadId={provider.current.threadId}
            mailboxAddress={mailbox.mailboxAddress}
            beforeLink={async () => {
              if (preparing || (dirty && !(await save()))) return undefined;
              return provider.current.threadId;
            }}
          />
          <div className="flex pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setShowCc((value) => !value || pendingRecipients.cc)
              }
            >
              Cc
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setShowBcc((value) => !value || pendingRecipients.bcc)
              }
            >
              Bcc
            </Button>
          </div>
        </div>
        {showCc && (
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 text-sm">
            <span className="pt-2 text-muted-foreground">Cc</span>
            <EmailRecipients
              label="Cc recipients"
              value={addresses(content.cc)}
              onChange={(value) => patch({ cc: value.join(", ") })}
              onPendingChange={(pending) =>
                setPendingRecipients((all) =>
                  all.cc === pending ? all : { ...all, cc: pending },
                )
              }
              disabled={blocked}
              threadId={provider.current.threadId}
              mailboxAddress={mailbox.mailboxAddress}
              beforeLink={async () => {
                if (preparing || (dirty && !(await save()))) return undefined;
                return provider.current.threadId;
              }}
            />
          </div>
        )}
        {showBcc && (
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 text-sm">
            <span className="pt-2 text-muted-foreground">Bcc</span>
            <EmailRecipients
              label="Bcc recipients"
              value={addresses(content.bcc)}
              onChange={(value) => patch({ bcc: value.join(", ") })}
              onPendingChange={(pending) =>
                setPendingRecipients((all) =>
                  all.bcc === pending ? all : { ...all, bcc: pending },
                )
              }
              disabled={blocked}
              threadId={provider.current.threadId}
              mailboxAddress={mailbox.mailboxAddress}
              beforeLink={async () => {
                if (preparing || (dirty && !(await save()))) return undefined;
                return provider.current.threadId;
              }}
            />
          </div>
        )}
        <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
          <span className="text-muted-foreground">Subject</span>
          <Input
            aria-label="Email subject"
            value={content.subject}
            disabled={blocked}
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => patch({ subject: event.target.value })}
          />
        </label>
      </div>
      <div
        className="pt-5"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
      >
        <EmailBodyEditor
          html={content.bodyHtml ?? textHtml(content.bodyText)}
          disabled={blocked}
          onChange={patch}
          onEditorReady={setRichEditor}
        />
      </div>
      {creationError && (
        <p role="alert" className="text-xs text-destructive">
          {creationError}
        </p>
      )}
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
            body.set("id", provider.current.id);
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
                  bodyHtml: conflict.bodyHtml ?? textHtml(conflict.bodyText),
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
    if (!scope) return;
    scope.registerClose((next) => {
      setPendingClose(() => next ?? scope.close);
    });
    return () => scope.registerClose(null);
  }, [scope, dirty, sending]);
  function close() {
    setPendingClose(() => onClose);
  }
  async function discardAndClose() {
    if (creationError) {
      const next = pendingClose;
      setPendingClose(null);
      next?.();
      return;
    }
    try {
      await command.mutateAsync({
        action: "discard",
        editToken: (editToken.current ??= crypto.randomUUID()),
        id: provider.current.id,
        changeKey: version.current,
      });
      try {
        localStorage.removeItem(recoveryKey);
      } catch {
        /* Optional recovery store. */
      }
      const next = pendingClose;
      setPendingClose(null);
      next?.();
    } catch {
      setStatus("Could not delete draft; it remains here.");
    }
  }
  async function saveAndClose() {
    if (!blocked && dirty && !(await save())) return;
    try {
      if (editToken.current && !provider.current.id.startsWith("local:"))
        await command.mutateAsync({
          action: "releaseDraft",
          id: provider.current.id,
          editToken: editToken.current,
        });
      const next = pendingClose;
      setPendingClose(null);
      next?.();
    } catch {
      setStatus("Could not close the shared editor; please retry.");
    }
  }
  return (
    <section
      className="m-4 space-y-4 rounded-2xl bg-muted/60 p-4 ring-1 ring-inset ring-border/40"
      aria-label="Shared email draft"
      data-email-shortcut-scope="typing"
    >
      <header className="flex items-center justify-between gap-2">
        <Popover
          open={Boolean(pendingClose)}
          onOpenChange={(open) => {
            if (open) close();
            else setPendingClose(null);
          }}
        >
          <PopoverTrigger asChild>
            <EmailIconButton label="Close editor" onClick={close}>
              <X className="h-4 w-4" />
            </EmailIconButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-52 space-y-1 p-1"
            aria-label="Draft options"
          >
            <Button
              variant="ghost"
              className="w-full justify-start"
              disabled={
                sending ||
                preparing ||
                command.isPending ||
                Boolean(creationError) ||
                Object.values(pendingRecipients).some(Boolean)
              }
              onClick={() => void saveAndClose()}
            >
              <Save className="mr-2 h-4 w-4" />
              {blocked ? "Keep draft and close" : "Save draft"}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              disabled={sending || preparing || command.isPending || blocked}
              onClick={() => void discardAndClose()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {creationError ? "Close without saving" : "Delete draft"}
            </Button>
          </PopoverContent>
        </Popover>
        <Badge variant="secondary" className="rounded-full">
          Draft
        </Badge>
      </header>
      {editor}
      {scheduledAt && new Date(scheduledAt).getTime() <= Date.now() && (
        <p role="alert" className="text-xs text-destructive">
          Choose a future send time or clear the schedule.
        </p>
      )}
      <div className="min-w-0 border-t pt-3">{footer}</div>
    </section>
  );
}

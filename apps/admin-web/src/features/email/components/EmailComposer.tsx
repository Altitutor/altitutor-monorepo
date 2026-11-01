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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DateTimePickerPopover,
  Badge,
} from "@altitutor/ui";
import {
  FileText,
  Paperclip,
  Clock,
  ArrowUp,
  X,
  LogOut,
  Trash2,
  LoaderCircle,
  CloudCheck,
  CircleAlert,
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
export type RegisterDraftClose = (
  id: string,
  prepare: () => Promise<boolean>,
) => () => void;
export function EmailComposer({
  draft,
  mailbox,
  signature,
  initialContent,
  onClose,
  draftReady,
  onSubjectChange,
  disabledReason,
  registerForClose,
}: {
  registerForClose?: RegisterDraftClose;
  disabledReason?: string;
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
  const [blockedByConflict, setBlocked] = useState(false);
  const blocked = blockedByConflict || Boolean(disabledReason);
  const [sending, setSending] = useState(false);
  const [recovery, setRecovery] = useState<Content | null>(null);
  const editToken = useRef<string | null>(null);
  const busy = useRef(false);
  const idleWaiters = useRef<Array<() => void>>([]);
  const attachmentQueue = useRef(Promise.resolve());
  const [queuedFiles, setQueuedFiles] = useState(0);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [attachedNames, setAttachedNames] = useState<string[]>([]);
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
      idleWaiters.current.splice(0).forEach((resolve) => resolve());
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
  function undoAttachment(attachmentId: string, name: string) {
    setQueuedFiles((count) => count + 1);
    attachmentQueue.current = attachmentQueue.current.then(async () => {
      if (busy.current)
        await new Promise<void>((resolve) => idleWaiters.current.push(resolve));
      busy.current = true;
      try {
        const result = draftResponseSchema.parse(
          await command.mutateAsync({
            action: "removeAttachment",
            id: provider.current.id,
            changeKey: version.current,
            editToken: (editToken.current ??= crypto.randomUUID()),
            attachmentId,
          }),
        );
        if (!result.message)
          throw new Error(
            "Attachment removal could not be confirmed. Refresh the draft.",
          );
        version.current = result.message.changeKey ?? "";
        setMessage(result.message);
        setAttachedNames((names) => {
          const index = names.indexOf(name);
          return names.filter((_, at) => at !== index);
        });
        setStatus("Attachment removed");
        toast.success("Attachment removed");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Attachment removal could not be confirmed.",
        );
      } finally {
        busy.current = false;
        idleWaiters.current.splice(0).forEach((resolve) => resolve());
        setQueuedFiles((count) => count - 1);
        setSaveRevision((value) => value + 1);
      }
    });
  }
  function attachFiles(files: File[]) {
    if (!files.length) return;
    setQueuedFiles((count) => count + files.length);
    for (const file of files) {
      attachmentQueue.current = attachmentQueue.current.then(async () => {
        let ownsBusy = false;
        try {
          if (file.size >= 3_000_000)
            throw new Error("Choose a file smaller than 3 MB for this upload.");
          if (blocked || conflict || creationError)
            throw new Error("Resolve this draft before attaching files.");
          if (draftReady) await draftReady;
          if (busy.current)
            await new Promise<void>((resolve) =>
              idleWaiters.current.push(resolve),
            );
          busy.current = true;
          ownsBusy = true;
          setStatus(`Attaching ${file.name}…`);
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
            throw new Error(z.object({ error: z.string() }).parse(value).error);
          const result = draftResponseSchema.parse(value);
          if (!result.message)
            throw new Error(
              "Attachment outcome could not be confirmed. Check the draft before retrying.",
            );
          setMessage(result.message);
          version.current = result.message.changeKey ?? "";
          setAttachedNames((names) => [...names, file.name]);
          setStatus(`Attached ${file.name}`);
          const attachment = z
            .object({ attachment: z.object({ id: z.string() }).optional() })
            .parse(value).attachment;
          toast.success(`Attached ${file.name}`, {
            ...(attachment
              ? {
                  action: {
                    label: "Undo",
                    onClick: () => undoAttachment(attachment.id, file.name),
                  },
                }
              : {}),
          });
        } catch (error) {
          setStatus(
            error instanceof Error ? error.message : "Attachment failed.",
          );
        } finally {
          if (ownsBusy) {
            busy.current = false;
            idleWaiters.current.splice(0).forEach((resolve) => resolve());
          }
          setQueuedFiles((count) => count - 1);
          setSaveRevision((value) => value + 1);
        }
      });
    }
  }
  async function send(at = scheduledAt ?? undefined) {
    if (
      sending ||
      queuedFiles > 0 ||
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
            : { action: "send" as const, undoDelaySeconds: 10 as const }),
          id: provider.current.id,
          changeKey: version.current,
          commandId: crypto.randomUUID(),
        }),
      );
      if (
        result.state === "submitted" ||
        result.state === "scheduled" ||
        result.state === "queued"
      ) {
        try {
          localStorage.removeItem(recoveryKey);
        } catch {
          /* Optional recovery store. */
        }
        setDirty(false);
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
    queuedFiles > 0 ||
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
          variant="default"
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
        className="border-t pt-3"
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
        multiple
        onChange={(event) => {
          attachFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {/(?:failed|could not|changed|rejected|unresolved|invalid|require|restricted|choose|enter|resolve)/i.test(
          status,
        ) && <p role="alert">{status}</p>}
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
    if (registerForClose)
      return registerForClose(draft.id, async () => {
        if (
          preparing ||
          creationError ||
          sending ||
          conflict ||
          (blocked && dirty) ||
          Object.values(pendingRecipients).some(Boolean)
        ) {
          setStatus(
            "Could not close yet. Finish recipients, wait for preparation, or resolve this draft first.",
          );
          return false;
        }
        await attachmentQueue.current;
        if (busy.current)
          await new Promise<void>((resolve) =>
            idleWaiters.current.push(resolve),
          );
        if (dirty && !(await save())) return false;
        if (editToken.current && !provider.current.id.startsWith("local:"))
          await command.mutateAsync({
            action: "releaseDraft",
            id: provider.current.id,
            editToken: editToken.current,
          });
        return true;
      });
    if (!scope) return;
    scope.registerClose((next) => {
      setPendingClose(() => next ?? scope.close);
    });
    return () => scope.registerClose(null);
    // The registered snapshot follows state that controls whether this editor may close;
    // content and provider versions are read from their current refs when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scope,
    registerForClose,
    draft.id,
    dirty,
    sending,
    preparing,
    creationError,
    conflict,
    blocked,
    pendingRecipients,
  ]);

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
      className={`relative m-4 space-y-4 rounded-2xl p-4 ring-1 ring-inset ${draggingFiles ? "bg-primary/10 ring-primary/50" : "bg-muted/60 ring-border/40"}`}
      onDragOverCapture={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
          setDraggingFiles(true);
        }
      }}
      onDragLeaveCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setDraggingFiles(false);
      }}
      onDropCapture={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        setDraggingFiles(false);
        attachFiles(Array.from(event.dataTransfer.files));
      }}
      aria-label="Shared email draft"
      data-email-shortcut-scope="typing"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu
            open={Boolean(pendingClose)}
            onOpenChange={(open) => {
              if (open) close();
              else setPendingClose(null);
            }}
          >
            <DropdownMenuTrigger asChild>
              <EmailIconButton
                label="Close editor"
                destructive
                variant="ghost"
                onClick={close}
              >
                <X className="h-4 w-4" />
              </EmailIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52"
              aria-label="Draft options"
            >
              <DropdownMenuItem
                className="justify-start"
                disabled={
                  sending ||
                  queuedFiles > 0 ||
                  preparing ||
                  command.isPending ||
                  Boolean(creationError) ||
                  Object.values(pendingRecipients).some(Boolean)
                }
                onClick={() => void saveAndClose()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Close draft
              </DropdownMenuItem>
              <DropdownMenuItem
                className="justify-start text-destructive focus:bg-destructive/10 focus:text-destructive"
                disabled={
                  sending ||
                  queuedFiles > 0 ||
                  preparing ||
                  command.isPending ||
                  blocked
                }
                onClick={() => void discardAndClose()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {creationError ? "Close without saving" : "Delete draft"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="status"
                  aria-label={disabledReason ?? status}
                  tabIndex={0}
                  className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground"
                >
                  {preparing || queuedFiles || sending || command.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : /(?:failed|could not|changed|rejected|unresolved|invalid|restricted)/i.test(
                      status,
                    ) ? (
                    <CircleAlert className="h-4 w-4 text-destructive" />
                  ) : (
                    <CloudCheck className="h-4 w-4" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>{disabledReason ?? status}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge variant="secondary" className="rounded-full">
          Draft
        </Badge>
      </header>
      {draggingFiles && (
        <p className="pointer-events-none absolute inset-x-4 top-12 z-10 rounded-lg bg-primary p-3 text-center text-sm text-primary-foreground">
          Drop files to attach
        </p>
      )}
      {editor}
      {attachedNames.length > 0 && (
        <ul aria-label="Attached files" className="flex flex-wrap gap-2">
          {attachedNames.map((name, index) => (
            <li
              key={`${name}:${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
            >
              <Paperclip className="h-3 w-3" />
              {name}
            </li>
          ))}
        </ul>
      )}
      {scheduledAt && new Date(scheduledAt).getTime() <= Date.now() && (
        <p role="alert" className="text-xs text-destructive">
          Choose a future send time or clear the schedule.
        </p>
      )}
      <div className="min-w-0 border-t pt-3">{footer}</div>
    </section>
  );
}

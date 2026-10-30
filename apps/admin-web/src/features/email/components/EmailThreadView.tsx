"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Archive, Mail, Reply, Trash2 } from "lucide-react";
import { Button, Checkbox, Input, SearchableSelect } from "@altitutor/ui";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { activityApi } from "@/features/activity/api";
import { communicationActivityAt } from "@/features/activity/lib/entityCommunication";
import {
  useEmailCommand,
  useEmailThread,
  useMailbox,
  mailRequest,
} from "../api/client";
import {
  draftResponseSchema,
  type EmailMessage,
  type EmailThread,
} from "../types";
import { EmailComposer } from "./EmailComposer";
import { EmailContextLinks } from "./EmailContextLinks";
import { EmailEnquiryActions } from "./EmailEnquiryActions";
import { EmailAssignee } from "./EmailAssignee";
import { EmailParticipant } from "./EmailParticipant";
const time = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Draft";
function Attachments({ id }: { id: string }) {
  const files = useQuery({
    queryKey: ["email", "attachments", id],
    queryFn: async () =>
      z
        .array(z.object({ id: z.string(), name: z.string(), type: z.string() }))
        .parse(await mailRequest(`/attachments?id=${encodeURIComponent(id)}`)),
  });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.data?.map((file) =>
        file.type === "#microsoft.graph.referenceAttachment" ? (
          <span key={file.id} className="text-xs text-muted-foreground">
            {file.name} · cloud attachment
          </span>
        ) : (
          <a
            key={file.id}
            className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
            href={`/api/email/attachments?id=${encodeURIComponent(id)}&attachment=${encodeURIComponent(file.id)}`}
          >
            {file.name}
          </a>
        ),
      )}
      {files.error && (
        <p role="alert" className="text-xs text-destructive">
          {files.error.message}
        </p>
      )}
    </div>
  );
}
function useThreadActivity(thread: EmailThread | undefined, enabled: boolean) {
  const links =
    thread?.links.filter((link) =>
      ["student", "parent", "staff"].includes(link.recordType),
    ) ?? [];
  const queries = useQueries({
    queries: links.map((link) => ({
      queryKey: ["email", "activity", link.recordType, link.recordId],
      enabled,
      queryFn: () =>
        link.recordType === "student"
          ? activityApi.getStudentActivity(link.recordId, 50, 0)
          : link.recordType === "parent"
            ? activityApi.getParentActivity(link.recordId, 50, 0)
            : activityApi.getStaffActivity(link.recordId, 50, 0),
    })),
  });
  const seen = new Set<string>();
  const entries: Array<{ id: string; at: string; content: ReactNode }> = [];
  if (enabled)
    for (const query of queries)
      for (const event of query.data?.events ?? []) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        entries.push({
          id: `activity:${event.id}`,
          at: communicationActivityAt(event, "logged"),
          content: (
            <ActivityFeed
              chronological
              timeBasis="logged"
              data={{ ...query.data!, events: [event] }}
            />
          ),
        });
      }
  return {
    entries,
    loading: enabled && queries.some((query) => query.isLoading),
    error: enabled && queries.find((query) => query.error)?.error,
  };
}
export function EmailThreadView({ threadId }: { threadId: string }) {
  const scope = useAccessoryTab();
  const thread = useEmailThread(threadId, scope?.active ?? true);
  const mailbox = useMailbox();
  const command = useEmailCommand();
  const [showActivity, setShowActivity] = useState(false);
  const [draft, setDraft] = useState<EmailMessage | null>(null);
  const [signature, setSignature] = useState<string>();
  const [forward, setForward] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [notice, setNotice] = useState("");
  const opened = useRef(new Set<string>());
  const activity = useThreadActivity(thread.data, showActivity);
  const messages = thread.data?.messages ?? [];
  const latest =
    messages.filter((message) => !message.draft).at(-1) ?? messages.at(-1);
  const subject = latest?.subject || "Email conversation";
  const participant = [...messages]
    .reverse()
    .find(
      (message) =>
        !message.draft &&
        message.sender &&
        message.sender.toLowerCase() !== mailbox.data?.mailboxAddress,
    );
  useEffect(() => {
    if (scope && !scope.active) return;
    const ids = messages
      .filter(
        (message) =>
          !message.draft &&
          !message.removed &&
          !message.read &&
          !opened.current.has(message.id),
      )
      .map((message) => message.id);
    if (ids.length) {
      ids.forEach((id) => opened.current.add(id));
      command.mutate({ action: "read", ids, read: true });
    }
    // Read each newly opened message once; explicit mark-unread remains shared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.data, scope?.active]);
  async function start(mode: "reply" | "replyAll" | "forward") {
    if (!latest) return;
    try {
      const result = draftResponseSchema.parse(
        await command.mutateAsync({
          action: "draft",
          messageId: latest.id,
          mode,
          ...(mode === "forward"
            ? {
                to: forwardTo
                  .split(/[,;]/)
                  .map((address) => address.trim())
                  .filter(Boolean),
              }
            : {}),
        }),
      );
      if (result.message) {
        setDraft(result.message);
        setSignature(result.signature);
        setForward(false);
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not create shared draft.",
      );
    }
  }
  const nonDraftIds = messages
    .filter((message) => !message.draft && !message.removed)
    .map((message) => message.id);
  useRegisterRecordActions("email", threadId, subject, [
    {
      id: "reply",
      title: "Reply to email",
      icon: Reply,
      disabled: !latest || command.isPending,
      action: () => {
        void start("reply");
      },
    },
    {
      id: "reply-all",
      title: "Reply all",
      icon: Reply,
      disabled: !latest || command.isPending,
      action: () => {
        void start("replyAll");
      },
    },
    {
      id: "archive",
      title: "Archive email",
      icon: Archive,
      disabled: !nonDraftIds.length || command.isPending,
      action: () =>
        command.mutate({
          action: "move",
          ids: nonDraftIds,
          folderId: "archive",
        }),
    },
    {
      id: "unread",
      title: "Mark email unread",
      icon: Mail,
      disabled: !nonDraftIds.length || command.isPending,
      action: () =>
        command.mutate({ action: "read", ids: nonDraftIds, read: false }),
    },
  ]);
  if (thread.isLoading || mailbox.isLoading)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Loading email conversation…
      </p>
    );
  if (thread.error || mailbox.error)
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {thread.error?.message ?? mailbox.error?.message}
      </p>
    );
  if (!thread.data || !mailbox.data) return null;
  const entries: Array<{ id: string; at: string; content: ReactNode }> =
    messages
      .filter((message) => !message.draft)
      .map((message) => ({
        id: message.id,
        at: message.sentAt ?? message.receivedAt ?? "",
        content: (
          <article className="border-b px-5 py-5">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <EmailParticipant
                  mailboxAddress={mailbox.data.mailboxAddress}
                  threadId={threadId}
                  email={message.sender}
                  label={message.senderName || message.sender}
                />
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {message.sender} → {message.to.join(", ")}
                  {message.cc.length > 0
                    ? ` · Cc: ${message.cc.join(", ")}`
                    : ""}
                </p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {time(message.sentAt ?? message.receivedAt)}
              </time>
            </header>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">
              {message.bodyText}
            </p>
            {message.removed && (
              <p className="mt-2 text-xs text-muted-foreground">
                Saved correspondence history
              </p>
            )}
            {message.hasAttachments && !message.removed && (
              <Attachments id={message.id} />
            )}
          </article>
        ),
      }));
  entries.push(...activity.entries);
  entries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      aria-label="Email conversation"
    >
      <header className="shrink-0 space-y-3 border-b p-4">
        <h1 className="text-lg font-semibold">{subject}</h1>
        {participant && (
          <EmailParticipant
            mailboxAddress={mailbox.data.mailboxAddress}
            threadId={threadId}
            email={participant.sender}
            label={participant.senderName || participant.sender}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EmailAssignee
            threadId={threadId}
            value={thread.data.assignedStaffId}
            staff={mailbox.data.staff}
            pill
          />
          {latest &&
            latest.sender !== mailbox.data?.mailboxAddress &&
            !latest.draft && (
              <EmailEnquiryActions messageId={latest.id} threadId={threadId} />
            )}
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={showActivity}
              onCheckedChange={(checked) => setShowActivity(checked === true)}
            />
            Show Activity
          </label>
        </div>
        <EmailContextLinks thread={thread.data} />
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Archive email conversation"
            disabled={command.isPending || !nonDraftIds.length}
            onClick={() =>
              command.mutate({
                action: "move",
                ids: nonDraftIds,
                folderId: "archive",
              })
            }
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Move email conversation to Deleted Items"
            disabled={command.isPending || !nonDraftIds.length}
            onClick={() =>
              command.mutate({
                action: "move",
                ids: nonDraftIds,
                folderId: "deleteditems",
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Mark email conversation unread"
            disabled={command.isPending || !nonDraftIds.length}
            onClick={() =>
              command.mutate({ action: "read", ids: nonDraftIds, read: false })
            }
          >
            <Mail className="h-4 w-4" />
          </Button>
          <SearchableSelect
            items={mailbox.data.folders}
            value={null}
            onValueChange={(folder) => {
              if (folder)
                command.mutate({
                  action: "move",
                  ids: nonDraftIds,
                  folderId: folder.id,
                });
            }}
            getItemId={(folder) => folder.id}
            getItemLabel={(folder) => folder.name}
            searchPlaceholder="Search Microsoft folders…"
            placeholder="Move to folder"
            disabled={!nonDraftIds.length || command.isPending}
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {entries.map((entry) => (
          <div key={entry.id}>{entry.content}</div>
        ))}
        {activity.loading && (
          <p className="p-3 text-xs text-muted-foreground">Loading Activity…</p>
        )}
        {activity.error && (
          <p role="alert" className="p-3 text-xs text-destructive">
            Could not load linked Activity.
          </p>
        )}
        {messages
          .filter((message) => message.draft)
          .map((message) => (
            <div
              key={message.id}
              className="m-3 rounded-md bg-muted p-3 text-xs"
            >
              <p className="font-medium">Shared draft · {message.subject}</p>
              <p className="mt-1 truncate text-muted-foreground">
                {message.bodyText}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setDraft(message);
                  setSignature(undefined);
                }}
              >
                Continue shared draft
              </Button>
            </div>
          ))}
        {thread.data.sends.map((send) => (
          <p
            key={send.message_id}
            role="status"
            className="px-4 py-2 text-xs text-muted-foreground"
          >
            {send.state === "failed"
              ? "Microsoft rejected this submission; the preserved draft can be reviewed and sent again"
              : send.state === "sent"
                ? "Confirmed in Microsoft Sent Items"
                : send.state === "submitted"
                  ? "Submitted to Microsoft; awaiting Sent Items confirmation"
                  : "Send outcome unresolved; do not submit another copy"}
          </p>
        ))}
      </div>
      {(command.error || notice) && (
        <p role="alert" className="p-3 text-xs text-destructive">
          {command.error?.message ?? notice}
        </p>
      )}
      {draft ? (
        <div className="max-h-[65%] shrink-0 overflow-auto">
          <EmailComposer
            key={draft.id}
            draft={draft}
            mailbox={mailbox.data}
            signature={signature}
            inline
            onClose={() => setDraft(null)}
          />
        </div>
      ) : (
        <footer className="flex shrink-0 flex-wrap gap-2 border-t p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void start("reply")}
            disabled={!latest || command.isPending}
          >
            <Reply className="mr-1 h-3 w-3" />
            Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void start("replyAll")}
            disabled={!latest || command.isPending}
          >
            Reply all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setForward(true)}
            disabled={!latest || command.isPending}
          >
            Forward
          </Button>
        </footer>
      )}
      <AdminDialogShell
        open={forward}
        onClose={() => setForward(false)}
        title="Forward email"
        subtitle="Choose a recipient for the shared forward draft."
        footer={
          <Button
            disabled={!forwardTo.trim() || command.isPending}
            onClick={() => void start("forward")}
          >
            Create forward draft
          </Button>
        }
      >
        <label className="text-sm">
          To
          <Input
            type="email"
            value={forwardTo}
            onChange={(event) => setForwardTo(event.target.value)}
          />
        </label>
      </AdminDialogShell>
    </div>
  );
}

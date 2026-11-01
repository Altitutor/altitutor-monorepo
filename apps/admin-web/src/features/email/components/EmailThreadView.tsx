"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Archive, Mail, Reply, Forward, ListFilter } from "lucide-react";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@altitutor/ui";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
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
import { EmailIconButton } from "./EmailIconButton";
import { EmailBody } from "./EmailBodyEditor";
import { EmailActions, EmailActionGroup } from "./EmailActions";
import { useAccessoryPanelActions } from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";
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
  const panel = useAccessoryPanelActions();
  const creating = threadId.startsWith("compose:");
  const thread = useEmailThread(
    creating ? "" : threadId,
    scope?.active ?? true,
  );
  const mailbox = useMailbox();
  const command = useEmailCommand();
  const [showActivity, setShowActivity] = useState(false);
  const [showMessages, setShowMessages] = useState(true);
  const [draft, setDraft] = useState<EmailMessage | null>(null);
  const [signature, setSignature] = useState<string>();
  const [draftReady, setDraftReady] = useState<
    Promise<{ message?: EmailMessage }> | undefined
  >();
  const [draftSubject, setDraftSubject] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string>();
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const opened = useRef(new Set<string>());
  const started = useRef(false);
  const handledAction = useRef("");
  const activity = useThreadActivity(thread.data, showActivity);
  const messages = thread.data?.messages ?? [];
  const latest =
    messages.filter((message) => !message.draft).at(-1) ?? messages.at(-1);
  const subject =
    draftSubject ||
    latest?.subject ||
    (creating || draft || latest?.draft ? "New email" : "Email conversation");
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  useAccessoryTitle(subject);
  useEffect(() => {
    if (!creating || !mailbox.data || started.current) return;
    started.current = true;
    setDraft({
      id: `local:${threadId}`,
      threadId: "",
      subject: "",
      bodyText: "",
      sender: mailbox.data.mailboxAddress,
      to: [],
      cc: [],
      bcc: [],
      draft: true,
      removed: false,
    });
    setSignature(mailbox.data.signature);
    const ready = command
      .mutateAsync({ action: "draft", mode: "new" })
      .then((value) => {
        const result = draftResponseSchema.parse(value);
        if (result.message && scope)
          panel?.navigateTab(scope.tab.key, {
            kind: "email",
            id: result.message.threadId,
            title: subjectRef.current,
          });
        return result;
      });
    setDraftReady(ready);
    // One provider draft per compose tab, including Strict Mode effect replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, mailbox.data]);
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
      command.mutate({ action: "read", ids, read: true, silent: true });
    }
    // Opening each provider message marks it once; explicit unread remains shared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.data, scope?.active]);
  function start(mode: "reply" | "replyAll" | "forward", original = latest) {
    if (!original || !mailbox.data || draft) return;
    const ownAddress = mailbox.data.mailboxAddress.toLowerCase();
    const recipients =
      mode === "forward"
        ? []
        : mode === "replyAll"
          ? [
              ...new Set(
                [original.sender, ...original.to, ...original.cc].filter(
                  (address) => address && address.toLowerCase() !== ownAddress,
                ),
              ),
            ]
          : [
              original.sender === ownAddress ? original.to[0] : original.sender,
            ].filter((address): address is string => Boolean(address));
    const quote =
      mode === "forward"
        ? `\n\nForwarded message from ${original.sender}:\n${original.bodyText}`
        : "";
    setDraft({
      ...original,
      id: `local:${crypto.randomUUID()}`,
      subject: `${mode === "forward" ? "Fwd" : "Re"}: ${original.subject.replace(/^(?:re|fwd):\s*/i, "")}`,
      bodyText: quote,
      bodyHtml: undefined,
      draft: true,
      to: recipients,
      cc: [],
      bcc: [],
      hasAttachments: false,
    });
    setSignature(mailbox.data.signature);
    setDraftReady(
      command
        .mutateAsync({
          action: "draft",
          messageId: original.id,
          mode,
          ...(mode === "forward" ? { to: [] } : {}),
        })
        .then((value) => draftResponseSchema.parse(value)),
    );
  }

  useEffect(() => {
    const query = scope?.tab.query ?? "";
    if (
      !query ||
      query === handledAction.current ||
      draft ||
      !latest ||
      !mailbox.data
    )
      return;
    const action = new URLSearchParams(query).get("action");
    if (action !== "reply" && action !== "forward" && action !== "draft")
      return;
    handledAction.current = query;
    if (action === "draft") {
      const candidate = messages.find(
        (message) =>
          message.draft &&
          !message.removed &&
          !thread.data?.sends.some(
            (send) =>
              send.message_id === message.id &&
              [
                "scheduled",
                "paused",
                "sending",
                "submitted",
                "uncertain",
              ].includes(send.state),
          ),
      );
      if (candidate) {
        setDraft(candidate);
        setSignature(undefined);
        setDraftReady(undefined);
      }
    } else start(action);
    if (scope) panel?.updateQuery(scope.tab.key, "");
    // Intent is consumed once after the target conversation has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.tab.query, latest, mailbox.data, draft]);
  const nonDraftIds = messages
    .filter((message) => !message.draft && !message.removed)
    .map((message) => message.id);
  useRegisterRecordActions("email", threadId, subject, [
    {
      id: "reply",
      title: "Reply to email",
      icon: Reply,
      disabled: !latest || Boolean(draft),
      action: () => start("reply"),
    },
    {
      id: "reply-all",
      title: "Reply all",
      icon: Reply,
      disabled: !latest || Boolean(draft),
      action: () => start("replyAll"),
    },
    {
      id: "forward",
      title: "Forward email",
      icon: Forward,
      disabled: !latest || Boolean(draft),
      action: () => start("forward"),
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
  if (!mailbox.data || (!draft && !thread.data && !creating))
    return (
      <p
        role={thread.error || mailbox.error ? "alert" : undefined}
        className="p-4 text-sm text-muted-foreground"
      >
        {thread.error?.message ??
          mailbox.error?.message ??
          "Loading email conversation…"}
      </p>
    );
  const data = thread.data;
  const contacts = [
    ...new Set(
      messages
        .flatMap((message) => [message.sender, ...message.to, ...message.cc])
        .filter(
          (email) =>
            email &&
            email.toLowerCase() !== mailbox.data.mailboxAddress.toLowerCase(),
        ),
    ),
  ];
  const entries: Array<{ id: string; at: string; content: ReactNode }> =
    showMessages
      ? messages
          .filter((message) => !message.draft)
          .map((message) => ({
            id: message.id,
            at: message.sentAt ?? message.receivedAt ?? "",
            content: (
              <article
                data-email-shortcut-target
                className="group relative m-4 rounded-2xl bg-muted/35 p-4"
                onMouseEnter={() => setHoveredCard(message.id)}
                onMouseLeave={() => setHoveredCard(undefined)}
                onFocus={() => setHoveredCard(message.id)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setHoveredCard(undefined);
                }}
                tabIndex={0}
                aria-label={`Email: ${message.subject || "No subject"}`}
              >
                <header className="relative mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <EmailParticipant
                      mailboxAddress={mailbox.data!.mailboxAddress}
                      threadId={threadId}
                      email={message.sender}
                      label={message.senderName || message.sender}
                    />
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      To {message.to.join(", ")}
                      {message.cc.length
                        ? ` · Cc ${message.cc.join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground group-hover:opacity-0 group-focus-within:opacity-0">
                    {time(message.sentAt ?? message.receivedAt)}
                  </time>
                  <div className="absolute right-0 top-0 z-10 rounded-full bg-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:relative [@media(hover:none)]:opacity-100">
                    <EmailActions
                      level="message"
                      ids={nonDraftIds}
                      threadId={threadId}
                      read={Boolean(message.read)}
                      assignedStaffId={data?.assignedStaffId ?? null}
                      mailbox={mailbox.data!}
                      hovered={hoveredCard === message.id}
                      onReply={
                        !draft && !message.removed
                          ? () => start("reply", message)
                          : undefined
                      }
                      onReplyAll={
                        !draft && !message.removed
                          ? () => start("replyAll", message)
                          : undefined
                      }
                      onForward={
                        !draft && !message.removed
                          ? () => start("forward", message)
                          : undefined
                      }
                    />
                  </div>
                </header>
                <EmailBody html={message.bodyHtml} text={message.bodyText} />
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
          }))
      : [];
  entries.push(...activity.entries);
  entries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const sends = data?.sends ?? [];
  function closeDraft() {
    setDraft(null);
    setDraftReady(undefined);
    setDraftSubject("");
    if (creating) scope?.close();
    else void thread.refetch();
  }
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      aria-label="Email conversation"
    >
      <header className="shrink-0 space-y-3 border-b p-4">
        <h1 className="truncate text-lg font-semibold">{subject}</h1>
        <div
          className="flex min-w-0 items-center justify-between gap-2"
          data-email-shortcut-target
          onMouseEnter={() => setToolbarHovered(true)}
          onMouseLeave={() => setToolbarHovered(false)}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
            {contacts.map((email) => (
              <span key={email} className="shrink-0">
                <EmailParticipant
                  email={email}
                  label={email}
                  threadId={threadId}
                  mailboxAddress={mailbox.data!.mailboxAddress}
                />
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EmailActions
              ids={nonDraftIds}
              threadId={threadId}
              read={messages
                .filter((message) => !message.draft && !message.removed)
                .every((message) => message.read)}
              assignedStaffId={data?.assignedStaffId ?? null}
              mailbox={mailbox.data}
              hovered={toolbarHovered && !hoveredCard}
              onReply={!draft ? () => start("reply") : undefined}
              onForward={!draft ? () => start("forward") : undefined}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <EmailIconButton label="Show messages and Activity">
                  <ListFilter className="h-4 w-4" />
                </EmailIconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={showMessages}
                  onCheckedChange={setShowMessages}
                >
                  Messages
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showActivity}
                  onCheckedChange={setShowActivity}
                >
                  Activity
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
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
        {showMessages &&
          messages
            .filter(
              (message) =>
                message.draft && !message.removed && message.id !== draft?.id,
            )
            .filter(() => !draft)
            .map((message) => (
              <section
                key={message.id}
                className="m-4 space-y-3 rounded-2xl bg-muted/60 p-4 ring-1 ring-inset ring-border/40"
              >
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium">
                    {message.subject || "New email"}
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    Draft
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {message.bodyText}
                </p>
                {!sends.some(
                  (send) =>
                    send.message_id === message.id &&
                    [
                      "scheduled",
                      "paused",
                      "sending",
                      "submitted",
                      "uncertain",
                    ].includes(send.state),
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setDraft(message);
                      setDraftReady(undefined);
                      setSignature(undefined);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </section>
            ))}
        {sends
          .filter((send) => send.state !== "sent")
          .map((send) => (
            <div
              key={send.command_id}
              role="status"
              className="mx-4 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
            >
              <span>
                {send.state === "scheduled"
                  ? `Scheduled for ${time(send.scheduled_at)}`
                  : send.state === "paused"
                    ? "Scheduled delivery paused after an Outlook draft change. Cancel to review it."
                    : send.state === "failed"
                      ? "Submission failed; review the preserved draft"
                      : send.state === "submitted"
                        ? "Submitted to Microsoft; awaiting Sent Items confirmation"
                        : "Send outcome unresolved; do not submit another copy"}
              </span>
              {["scheduled", "paused"].includes(send.state) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() =>
                    command.mutate({
                      action: "cancelSchedule",
                      id: send.command_id,
                    })
                  }
                >
                  Cancel schedule
                </Button>
              )}
            </div>
          ))}
        {draft ? (
          <EmailComposer
            key={draft.id}
            draft={draft}
            mailbox={mailbox.data}
            signature={signature}
            draftReady={draftReady}
            inline
            onSubjectChange={setDraftSubject}
            onClose={closeDraft}
          />
        ) : (
          showMessages &&
          latest &&
          !latest.draft && (
            <div className="flex gap-2 p-4">
              <EmailActionGroup label="Respond to email">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => start("reply")}
                >
                  <Reply className="mr-1.5 h-4 w-4" />
                  Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => start("replyAll")}
                >
                  Reply all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => start("forward")}
                >
                  <Forward className="mr-1.5 h-4 w-4" />
                  Forward
                </Button>
              </EmailActionGroup>
            </div>
          )
        )}
        {(command.error || thread.error || mailbox.error) && (
          <p role="alert" className="p-3 text-xs text-destructive">
            {command.error?.message ??
              thread.error?.message ??
              mailbox.error?.message}
          </p>
        )}
      </div>
    </div>
  );
}

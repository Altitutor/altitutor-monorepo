"use client";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { CheckSquare, AlertTriangle } from "lucide-react";
import { adminPageHeaderClass } from "@/shared/components/adminPageHeaderStyle";
import { Breadcrumb, BreadcrumbName, type BreadcrumbItem } from "@/shared/components/Breadcrumb";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueries } from "@tanstack/react-query";
import { Archive, Mail, Reply, Forward, ListFilter } from "lucide-react";
import {
  Button,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@altitutor/ui";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { activityApi } from "@/features/activity/api";
import { communicationActivityAt } from "@/features/activity/lib/entityCommunication";
import { emailConversationPerson, useEmailConversationContact } from "../api/useEmailConversationContact";
import { useConversationMeetingActions } from "@/features/messages/hooks/useConversationMeetingActions";
import { useEmailCommand, useEmailThread, useMailbox } from "../api/client";
import {
  draftResponseSchema,
  type EmailMessage,
  type EmailThread,
} from "../types";
import { toast } from "sonner";
import { EmailComposer, type RegisterDraftClose } from "./EmailComposer";
import { EmailIconButton } from "./EmailIconButton";
import { EmailBody } from "./EmailBodyEditor";
import { EmailActions } from "./EmailActions";
import { useAccessoryPanelActions } from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { isEditableDraft } from "./drafts";
import { EmailParticipant } from "./EmailParticipant";
import { EmailAttachments } from "./EmailAttachments";
import { EmailPendingMessage } from "./EmailPendingMessage";
import { MailFolders, mailFolderLabel } from "./MailFolders";
import { createPortal } from "react-dom";
const time = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Draft";
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
export function EmailThreadView({
  threadId,
  registerInlineClose,
  onBack,
  headerTarget,
  folderItem,
}: {
  threadId: string;
  registerInlineClose?: (gate: ((next?: () => void) => void) | null) => void;
  onBack?: () => void;
  headerTarget?: HTMLElement | null;
  folderItem?: BreadcrumbItem;
}) {
  const { router, searchParams } = usePaneNavigation();
  const navigation = useEntityNavigation();
  const targetMessageId = searchParams.get("message");
  const referenceFocus = searchParams.get("focus");
  const targetKey = `${targetMessageId ?? ""}:${referenceFocus ?? ""}`;
  const referenceRoot = useRef<HTMLDivElement>(null);
  const revealedMessage = useRef<string | null>(null);
  const quickActions = useQuickActions();
  const scope = useAccessoryTab();
  const panel = useAccessoryPanelActions();
  const creating = threadId.startsWith("compose:");
  const thread = useEmailThread(
    creating ? "" : threadId,
    scope?.active ?? true,
  );
  const mailbox = useMailbox();
  const command = useEmailCommand();
  const person = useEmailConversationContact(thread.data);
  const meetings = useConversationMeetingActions(person.data);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const closeEditors = useRef(new Map<string, () => Promise<boolean>>());
  const closing = useRef(false);
  const [closingEditors, setClosingEditors] = useState(false);
  const registerDraftClose = useCallback<RegisterDraftClose>((id, prepare) => {
    closeEditors.current.set(id, prepare);
    return () => {
      if (closeEditors.current.get(id) === prepare)
        closeEditors.current.delete(id);
    };
  }, []);
  const registerClose = scope?.registerClose ?? registerInlineClose;
  const closeConversation = scope?.close;
  useEffect(() => {
    if (!registerClose) return;
    registerClose((next) => {
      if (closing.current) return;
      closing.current = true;
      setClosingEditors(true);
      void (async () => {
        for (const prepare of [...closeEditors.current.values()]) {
          if (!(await prepare())) {
            toast.error(
              "Some drafts still need attention. The conversation was kept open.",
            );
            return;
          }
        }
        (next ?? closeConversation)?.();
      })()
        .catch(() =>
          toast.error(
            "Drafts could not be saved. The conversation was kept open.",
          ),
        )
        .finally(() => {
          closing.current = false;
          setClosingEditors(false);
        });
    });
    return () => registerClose(null);
  }, [registerClose, closeConversation]);
  const [collapsedEmails, setCollapsedEmails] = useState<Set<string>>(() => new Set());
  const [showActivity, setShowActivity] = useState(false);
  const [showMessages, setShowMessages] = useState(true);
  const [draft, setDraft] = useState<EmailMessage | null>(null);
  const [signature, setSignature] = useState<string>();
  const [draftReady, setDraftReady] = useState<
    Promise<{ message?: EmailMessage }> | undefined
  >();
  const [preparedDraftId, setPreparedDraftId] = useState<string>();
  const [dismissedDrafts, setDismissedDrafts] = useState<string[]>([]);
  const [focusDraftId, setFocusDraftId] = useState<string>();
  const draftCards = useRef(new Map<string, HTMLDivElement>());
  const [reuse, setReuse] = useState<{
    message: EmailMessage;
    original: EmailMessage;
    mode: "reply" | "replyAll";
  } | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string>();
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const opened = useRef(new Set<string>());
  const started = useRef(false);
  const handledAction = useRef("");
  const activity = useThreadActivity(thread.data, showActivity);
  const messages = (thread.data?.messages ?? []).filter(
    (message) =>
      !message.draft || isEditableDraft(message, mailbox.data?.folders ?? []),
  );
  useEffect(() => {
    if (!targetMessageId) return;
    setCollapsedEmails((current) => {
      if (!current.has(targetMessageId)) return current;
      const next = new Set(current);
      next.delete(targetMessageId);
      return next;
    });
  }, [targetMessageId, targetKey]);
  useEffect(() => {
    if (
      !targetMessageId ||
      collapsedEmails.has(targetMessageId) ||
      revealedMessage.current === targetKey ||
      !showMessages
    )
      return;
    const card = referenceRoot.current?.querySelector<HTMLElement>(
      `[data-email-message-id="${CSS.escape(targetMessageId)}"]`,
    );
    if (card) {
      card.scrollIntoView({ block: "center", behavior: "instant" });
      card.focus({ preventScroll: true });
      revealedMessage.current = targetKey;
    }
  }, [collapsedEmails, targetMessageId, targetKey, thread.data, showMessages]);
  useEffect(() => {
    if (targetMessageId) setShowMessages(true);
  }, [targetMessageId]);
  const liveDrafts = messages.filter(
    (message) =>
      isEditableDraft(message, mailbox.data?.folders ?? []) &&
      (!dismissedDrafts.includes(message.id) ||
        Boolean(pendingSend(message.id))),
  );
  function pendingSend(id: string) {
    return thread.data?.sends.find(
      (send) =>
        send.message_id === id &&
        ["scheduled", "paused", "sending", "submitted", "uncertain"].includes(
          send.state,
        ),
    );
  }
  useEffect(() => {
    if (scope?.active === false || !focusDraftId) return;
    if (!showMessages) {
      setShowMessages(true);
      return;
    }
    const card = draftCards.current.get(focusDraftId);
    if (card) {
      card.scrollIntoView({ block: "start", behavior: "smooth" });
      card
        .querySelector<HTMLInputElement>('input[aria-label="Email subject"]')
        ?.focus({ preventScroll: true });
      setFocusDraftId(undefined);
    }
  }, [focusDraftId, liveDrafts.length, scope?.active, showMessages]);
  const latest =
    messages.filter((message) => !message.draft).at(-1) ?? messages.at(-1);
  const replyTarget = messages.findLast((message) => !message.draft && !message.removed);
  const canReply = Boolean(replyTarget && !draft);
  function toggleEmail(id: string) {
    setCollapsedEmails((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
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
        setPreparedDraftId(result.message?.id);
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
  function start(
    mode: "reply" | "replyAll" | "forward",
    original = replyTarget,
    forceNew = false,
  ) {
    if (closing.current || !original || original.draft || original.removed || !mailbox.data || draft) return;
    if (!forceNew && mode !== "forward") {
      const existing = liveDrafts.find(
        (message) =>
          (message.replyToMessageId === original.id ||
            Boolean(
              original.internetMessageId &&
                message.replyToInternetMessageIds?.includes(
                  original.internetMessageId,
                ),
            )) &&
          message.draftMode !== "forward" &&
          !pendingSend(message.id),
      );
      if (existing) {
        setReuse({ message: existing, original, mode });
        return;
      }
    }
    setPreparedDraftId(undefined);
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
      draftMode: mode,
      replyToMessageId: original.id,
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
        .then((value) => {
          const result = draftResponseSchema.parse(value);
          setPreparedDraftId(result.message?.id);
          return result;
        }),
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
      const requested = new URLSearchParams(query).get("message");
      const candidates = messages.filter((message) =>
        isEditableDraft(message, mailbox.data?.folders ?? []),
      );
      const candidate =
        candidates.find((message) => message.id === requested) ??
        candidates.at(-1);
      if (candidate) {
        setDismissedDrafts((all) => all.filter((id) => id !== candidate.id));
        setShowMessages(true);
        setFocusDraftId(candidate.id);
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
      id: "add-task",
      title: "Create task",
      icon: CheckSquare,
      primaryOnly: true,
      disabled: !latest,
      action: () => {
        if (latest)
          quickActions.openCreateTaskDialog({
            type: "email",
            id: latest.id,
            label: subject,
          });
      },
    },
    {
      id: "add-issue",
      title: "Create issue",
      icon: AlertTriangle,
      primaryOnly: true,
      disabled: !latest,
      action: () => {
        if (latest)
          quickActions.openCreateIssueDialog({
            type: "email",
            id: latest.id,
            label: subject,
          });
      },
    },
    {
      id: "reply",
      title: "Reply to email",
      icon: Reply,
      disabled: closingEditors || !canReply,
      action: () => start("reply"),
    },
    {
      id: "reply-all",
      title: "Reply all",
      icon: Reply,
      disabled: closingEditors || !canReply,
      action: () => start("replyAll"),
    },
    {
      id: "forward",
      title: "Forward email",
      icon: Forward,
      disabled: closingEditors || !canReply,
      action: () => start("forward"),
    },
    {
      id: "archive",
      title: "Archive email",
      icon: Archive,
      disabled: closingEditors || !nonDraftIds.length || command.isPending,
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
      disabled: closingEditors || !nonDraftIds.length || command.isPending,
      action: () =>
        command.mutate({ action: "read", ids: nonDraftIds, read: false }),
    },
  ]);
  const folders = mailbox.data?.folders ?? [];
  const originFolder = searchParams.get("folder") ?? undefined;
  const folder = originFolder ?? latest?.folderId ?? undefined;
  const openFolder = (id?: string) => router.push(id === undefined
    ? "/email"
    : `/email?${new URLSearchParams({ folder: id })}`);
  const breadcrumbs = (
    <Breadcrumb
      items={[
        { label: "Email", onClick: onBack ?? (() => openFolder(originFolder)) },
        folderItem ?? {
          label: mailFolderLabel(folders, folder),
          control: <MailFolders folders={folders} selected={folder} onSelect={openFolder} />,
        },
        { label: subject },
      ]}
      className="m-0 min-w-0 gap-1.5 [&>div:first-child]:shrink-0"
    />
  );
  function renderHeader(header: ReactNode) {
    return headerTarget === undefined ? header : headerTarget && createPortal(header, headerTarget);
  }

  if (!mailbox.data || (!draft && !thread.data && !creating))
    return (
      <>
        {renderHeader(<header className={adminPageHeaderClass} data-admin-page-header>{breadcrumbs}</header>)}
        <p
          role={thread.error || mailbox.error ? "alert" : undefined}
          className="p-4 text-sm text-muted-foreground"
        >
          {thread.error?.message ??
            mailbox.error?.message ??
            "Loading email conversation…"}
        </p>
      </>
    );
  const data = thread.data;
  const headerPerson = emailConversationPerson(data);
  const entries: Array<{ id: string; at: string; content: ReactNode }> =
    showMessages
      ? messages
          .filter((message) => !message.draft && (!messageSearch.trim() || `${message.subject} ${message.bodyText}`.toLowerCase().includes(messageSearch.trim().toLowerCase())))
          .map((message) => {
            const collapsed = collapsedEmails.has(message.id);
            const bodyId = `email-body-${message.id}`;
            const content = (
              <article
                data-email-message-id={message.id}
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
                <header
                  className="relative flex min-h-6 cursor-pointer items-start gap-3"
                  onClick={(event) => {
                    if (event.target instanceof Element && !event.target.closest("button, a, [role=button], [role=menuitem]")) toggleEmail(message.id);
                  }}
                >
                  <button
                    type="button"
                    aria-label={`${collapsed ? "Expand" : "Collapse"} email from ${message.senderName || message.sender}`}
                    aria-expanded={!collapsed}
                    aria-controls={bodyId}
                    className="absolute -inset-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => toggleEmail(message.id)}
                  />
                  <div className="relative max-w-[50%] min-w-0 shrink">
                    <EmailParticipant
                      mailboxAddress={mailbox.data!.mailboxAddress}
                      threadId={threadId}
                      email={message.sender}
                      label={message.senderName || message.sender}
                    />
                    {!collapsed && Boolean(message.to.length || message.cc.length) && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Show recipients"
                            className="mt-1 block max-w-full truncate text-left text-xs text-muted-foreground hover:text-foreground"
                          >
                            To {message.to.join(", ")}
                            {message.cc.length > 0 && ` · Cc ${message.cc.join(", ")}`}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-2rem))] space-y-3 overflow-y-auto">
                          {([["To", message.to], ["Cc", message.cc]] as const).map(([label, recipients]) =>
                            recipients.length ? (
                              <div key={label} className="space-y-1">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <div className="flex flex-wrap gap-1">
                                  {[...new Set(recipients)].map((email) => (
                                    <EmailParticipant
                                      key={email}
                                      email={email}
                                      label={email}
                                      threadId={threadId}
                                      mailboxAddress={mailbox.data!.mailboxAddress}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : null,
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {collapsed && <p data-email-preview className="pointer-events-none min-w-0 flex-1 truncate self-center text-xs text-muted-foreground">
                    {message.bodyText.replace(/\s+/g, " ").trim() || message.subject}
                  </p>}
                  <time className="pointer-events-none ml-auto shrink-0 self-center text-xs text-muted-foreground group-hover:opacity-0 group-focus-within:opacity-0">
                    {time(message.sentAt ?? message.receivedAt)}
                  </time>
                  <div className={`absolute right-0 z-10 rounded-full bg-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:relative [@media(hover:none)]:opacity-100 ${collapsed ? "top-1/2 -translate-y-1/2 [@media(hover:none)]:top-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:self-center" : "top-0"}`}>
                    <EmailActions
                      messageId={message.id}
                      messageLabel={message.subject || "No subject"}
                      level="message"
                      ids={nonDraftIds}
                      threadId={threadId}
                      read={Boolean(message.read)}
                      assignedStaffId={data?.assignedStaffId ?? null}
                      mailbox={mailbox.data!}
                      hovered={hoveredCard === message.id}
                      enquiryEligible={!draft && !message.removed && Boolean(message.receivedAt)
                        && message.sender.trim().toLowerCase() !== mailbox.data!.mailboxAddress}
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
                <div
                  id={bodyId}
                  data-email-body
                  inert={collapsed}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="pt-4">
                      <EmailBody html={message.bodyHtml} text={message.bodyText} />
                      {message.removed && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Saved correspondence history
                        </p>
                      )}
                      {message.hasAttachments && !message.removed && (
                        <EmailAttachments id={message.id} />
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
            return { id: message.id, at: message.sentAt ?? message.receivedAt ?? "", content };
          })
      : [];
  entries.push(...activity.entries);
  entries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const sends = data?.sends ?? [];
  function closeDraft() {
    if (preparedDraftId || draft?.id)
      setDismissedDrafts((all) => [...all, preparedDraftId ?? draft!.id]);
    setDraft(null);
    setDraftReady(undefined);
    setPreparedDraftId(undefined);
    setDraftSubject("");
    if (creating) scope?.close();
    else void thread.refetch();
  }
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      ref={referenceRoot}
      aria-label="Email conversation"
      inert={closingEditors}
      aria-busy={closingEditors}
    >
      {renderHeader(<header className="shrink-0" inert={closingEditors}>
        <div
          data-admin-page-header
          className={adminPageHeaderClass}
          data-email-shortcut-target
          onMouseEnter={() => setToolbarHovered(true)}
          onMouseLeave={() => setToolbarHovered(false)}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {breadcrumbs}
            {headerPerson?.label && (
              <BreadcrumbName
                label={headerPerson.label}
                entity={headerPerson}
                onClick={() => navigation.openEntity(headerPerson.type, headerPerson.id)}
                className="max-w-[35%] min-w-0 shrink-0 text-sm text-muted-foreground"
              />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EmailActions
              onSearchToggle={() => { if (searchOpen) setMessageSearch(""); setSearchOpen(!searchOpen); }}
              moreMenuItems={meetings.menuItems}
              messageId={latest?.id}
              messageLabel={subject}
              ids={nonDraftIds}
              threadId={threadId}
              read={messages
                .filter((message) => !message.draft && !message.removed)
                .every((message) => message.read)}
              assignedStaffId={data?.assignedStaffId ?? null}
              mailbox={mailbox.data}
              hovered={toolbarHovered && !hoveredCard}
              captureWhenIdle
              onReply={canReply ? () => start("reply") : undefined}
              onReplyAll={canReply ? () => start("replyAll") : undefined}
              onForward={canReply ? () => start("forward") : undefined}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <EmailIconButton data-shortcut-filter shortcut="F" label="Show messages and Activity">
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
        {searchOpen && (
          <div className="px-4 pt-4">
            <Input type="search" aria-label="Search conversation" placeholder="Search this conversation" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} autoFocus />
          </div>
        )}
      </header>)}
      {meetings.dialogs}
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
        <div hidden={!showMessages}>
          {liveDrafts
            .filter(
              (message) =>
                message.id !== draft?.id &&
                (!draft || message.id !== preparedDraftId),
            )
            .map((message) => {
              const pending = pendingSend(message.id);
              return (
                <div
                  key={message.id}
                  ref={(element) => {
                    if (element) draftCards.current.set(message.id, element);
                    else draftCards.current.delete(message.id);
                  }}
                >
                  {pending ? (
                    <EmailPendingMessage
                      message={message}
                      state={pending.state}
                      scheduledAt={pending.scheduled_at}
                      mailboxAddress={mailbox.data!.mailboxAddress}
                      busy={command.isPending}
                      onCancel={() =>
                        command.mutate({
                          action: "cancelSchedule",
                          id: pending.command_id,
                        })
                      }
                    />
                  ) : (
                    <EmailComposer
                      registerForClose={registerDraftClose}
                      draft={message}
                      mailbox={mailbox.data!}
                      inline
                      onClose={() => {
                        setDismissedDrafts((all) => [...all, message.id]);
                        void thread.refetch();
                      }}
                    />
                  )}
                </div>
              );
            })}
        </div>
        {sends
          .filter(
            (send) =>
              send.state !== "sent" &&
              !liveDrafts.some(
                (message) =>
                  message.id === send.message_id && pendingSend(message.id),
              ),
          )
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
            registerForClose={registerDraftClose}
            draft={draft}
            mailbox={mailbox.data}
            signature={signature}
            draftReady={draftReady}
            inline
            onSubjectChange={setDraftSubject}
            onClose={closeDraft}
          />
        ) : null}
        {(command.error || thread.error || mailbox.error) && (
          <p role="alert" className="p-3 text-xs text-destructive">
            {command.error?.message ??
              thread.error?.message ??
              mailbox.error?.message}
          </p>
        )}
      </div>
      <AdminDialogShell
        open={Boolean(reuse)}
        onClose={() => setReuse(null)}
        title="Continue existing reply draft?"
        subtitle="Continue that draft or create a separate reply."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const request = reuse;
                setReuse(null);
                if (request) start(request.mode, request.original, true);
              }}
            >
              Create another draft
            </Button>
            <Button
              onClick={() => {
                if (reuse) setFocusDraftId(reuse.message.id);
                setReuse(null);
              }}
            >
              Edit existing draft
            </Button>
          </>
        }
      >
        <p className="text-sm">
          There is already a draft replying to this email. Continue editing it?
        </p>
      </AdminDialogShell>
    </div>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Check, ChevronDown, MessageSquare } from "lucide-react";
import { cn } from "@/shared/utils";
import { useActivityHistorySearch } from "../hooks/useActivityHistorySearch";
import { useChildrenActivity } from "../hooks/useChildrenActivity";
import { CommunicationSourceFilter } from "./CommunicationSourceFilter";
import { useEntityEmails } from "@/features/email/api/client";
import { EmailCorrespondenceCard } from "@/features/email/components/EmailCorrespondenceCard";
import { Composer } from "@/features/messages/components/Composer";
import {
  MessageThread,
  type ThreadFeedEntry,
} from "@/features/messages/components/MessageThread";
import { ActivityFeed } from "./ActivityFeed";
import { ActivityFeedToolbar, messageActivityFilters } from "./ActivityFeedToolbar";
import { matchesActivityFilters, matchesActivityItem, type ActivityFilters } from "../lib/activityFeedFilters";
import { mapActivityEventsToDisplay } from "../mappers";
import { FormResponsePicker } from "@/features/forms/components/FormResponsePicker";
import { ComposeModeControl, type ComposeMode } from "./ComposeModeControl";
import { NoteComposerWithTemplate } from "@/shared/components/NoteComposerWithTemplate";
import { FormResponseDialog } from "@/features/feedback/components/FormResponseDialog";
import { isTiptapContentEmpty } from "@/shared/utils/plainTextToTiptapJson";
import { isMessageComposerSendShortcut } from "@/features/messages/utils/composerShortcut";
import {
  getMessagingDraftKey,
  usePersistedConversationDraft,
} from "@/features/messages/state/messagingUiStore";
import {
  useParentActivity,
  useStaffActivity,
  useStudentActivity,
  useFormResponseDialog,
  useEntityActivityNoteComposer,
  activityKeys,
} from "../hooks";
import {
  useEntityCommunicationContext,
  useEntityCommunicationMessages,
} from "../hooks/useEntityCommunication";
import {
  ACTIVITY_SOURCE_ID,
  EMAIL_SOURCE_ID,
  hasActivitySource,
  messageConversationSources,
  communicationActivityAt,
  communicationContactDetail,
  communicationFilterOptions,
  contactSourceId,
  defaultRecipientId,
  groupConversationSourceId,
  sourcesAfterRecipientChange,
  type CommunicationEntityType,
  type CommunicationTimeSort,
} from "../lib/entityCommunication";

interface EntityCommunicationPanelProps {
  entityType: CommunicationEntityType;
  entityId: string;
  enabled?: boolean;
  allowForm?: boolean;
  className?: string;
  initialContactId?: string;
  initialDestinationAddress?: string;
  initialSenderId?: string;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onExitSearch?: () => void;
  renderHeader?: (filterControl: ReactNode) => ReactNode;
}

function emailAddress(value: string) {
  return (value.match(/<([^>]+)>$/)?.[1] ?? value).trim().toLowerCase();
}

function activityQueryKey(
  entityType: CommunicationEntityType,
  entityId: string,
) {
  if (entityType === "student") return activityKeys.student(entityId);
  if (entityType === "staff") return activityKeys.staff(entityId);
  return activityKeys.parent(entityId);
}

export function EntityCommunicationPanel(props: EntityCommunicationPanelProps) {
  return (
    <EntityCommunicationContent
      key={`${props.entityType}:${props.entityId}:${props.initialContactId ?? ""}`}
      {...props}
    />
  );
}

function EntityCommunicationContent({
  entityType,
  entityId,
  enabled = true,
  allowForm = false,
  className,
  initialContactId,
  initialDestinationAddress,
  initialSenderId,
  isSearching,
  searchTerm,
  onSearchTermChange,
  onExitSearch,
  renderHeader,
}: EntityCommunicationPanelProps) {
  const queryClient = useQueryClient();
  const [preferredSenderId, setPreferredSenderId] = useState<string | null>(
    null,
  );
  const [mode, setMode] = useState<ComposeMode | "form">("message");
  const [timeSort, setTimeSort] = useState<CommunicationTimeSort>("logged");
  const [filters, setFilters] = useState<ActivityFilters>(initialContactId ? messageActivityFilters : {});
  const [feedSearch, setFeedSearch] = useState("");
  const [sourceOverride, setSourceOverride] = useState<string[] | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const context = useEntityCommunicationContext(entityType, entityId, enabled);
  const contacts = useMemo(
    () => context.data?.contacts ?? [],
    [context.data?.contacts],
  );
  const conversations = useMemo(
    () => context.data?.conversations ?? [],
    [context.data?.conversations],
  );
  const messageOnly = filters.scope?.includes("direct");
  const directSources = initialContactId
    ? messageConversationSources(initialContactId)
    : contacts.filter((contact) => contact.kind === entityType).map((contact) => contactSourceId(contact.id));
  const defaultSources = messageOnly
    ? directSources
    : [
        ACTIVITY_SOURCE_ID,
        EMAIL_SOURCE_ID,
        ...contacts.map((contact) => contactSourceId(contact.id)),
        ...conversations.filter((conversation) => conversation.is_group_chat)
          .map((conversation) => groupConversationSourceId(conversation.id)),
      ];
  const allowType = (prefix: string) =>
    !filters.type?.length || filters.type.some((value) => typeof value === "string" && value.startsWith(prefix));
  const sources = sourceOverride ?? defaultSources;
  const messageConversations = conversations.filter((conversation) =>
    sources.includes(conversation.is_group_chat
      ? groupConversationSourceId(conversation.id)
      : contactSourceId(conversation.contact_id ?? "")),
  );
  const showMessages = allowType("message:") && messageConversations.length > 0;
  const showEmails = sources.includes(EMAIL_SOURCE_ID) && allowType("email:");
  const messages = useEntityCommunicationMessages(messageConversations, enabled && showMessages);
  const emails = useEntityEmails(entityType, entityId, enabled && showEmails);
  const showActivity = hasActivitySource(sources);
  const wantsActivity = !filters.type?.length || filters.type.some((value) =>
    typeof value === "string" && !value.startsWith("message:") && !value.startsWith("email:"),
  );
  const showOwnActivity = wantsActivity && sources.includes(ACTIVITY_SOURCE_ID);
  const childrenActivity = useChildrenActivity(
    context.data?.children ?? [],
    wantsActivity ? sources : [],
    enabled,
  );
  const studentActivity = useStudentActivity(
    entityType === "student" ? entityId : null,
    enabled && showOwnActivity,
  );
  const staffActivity = useStaffActivity(
    entityType === "staff" ? entityId : null,
    enabled && showOwnActivity,
  );
  const parentActivity = useParentActivity(
    entityType === "parent" ? entityId : null,
    enabled && showOwnActivity,
  );
  const activity =
    entityType === "student"
      ? studentActivity
      : entityType === "staff"
        ? staffActivity
        : parentActivity;
  const { selectedResponse, openFormResponse, closeFormResponse } =
    useFormResponseDialog();
  const noteComposer = useEntityActivityNoteComposer({
    targetType: entityType,
    targetId: entityId,
    activityQueryKey: activityQueryKey(entityType, entityId),
  });

  const filterOptions = communicationFilterOptions({
    includeEmail: true,
    children: context.data?.children,
    contacts: contacts.map((person) => ({
      ...person,
      detail: communicationContactDetail(person, entityType),
    })),
    groups: conversations
      .filter((conversation) => conversation.is_group_chat)
      .map((conversation) => ({
        id: conversation.id,
        label: conversation.group_chat_name || "Group texts",
      })),
  });
  const selected =
    destination ??
    initialContactId ??
    defaultRecipientId({ entityType, contacts });
  const contact = contacts.find((item) => item.id === selected) ?? null;
  const group = conversations.find(
    (conversation) =>
      conversation.id === selected && conversation.is_group_chat,
  );
  const viewingHistory = Boolean(
    contact && contact.kind === entityType && !contact.isCurrent,
  );

  const recipients = useMemo(
    () => [
      ...contacts.map((person) => ({
        id: person.id,
        label: person.label,
        detail: communicationContactDetail(person, entityType),
      })),
      ...conversations
        .filter((conversation) => conversation.is_group_chat)
        .map((conversation) => ({
          id: conversation.id,
          label: conversation.group_chat_name || "Existing group",
          detail: "Group",
        })),
    ],
    [contacts, conversations, entityType],
  );
  const selectedRecipient = recipients.find(
    (recipient) => recipient.id === selected,
  );

  const draftKey =
    !showActivity || mode === "message"
      ? getMessagingDraftKey(
          group
            ? { kind: "group", conversationId: group.id }
            : { kind: "contact", contactId: contact?.id ?? null },
        )
      : null;
  const { draft, onDraftChange, onDraftClear } =
    usePersistedConversationDraft(draftKey);

  function sourceFor(conversationId: string) {
    const conversation = messageConversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation) return null;
    const person = contacts.find((item) => item.id === conversation.contact_id);
    return {
      category: `message:${conversation.is_group_chat ? "group" : person?.kind ?? entityType}`,
      label: person?.label ?? conversation.group_chat_name ?? "",
    };
  }

  const visible = (
    messages.data?.pages.flatMap((page) => page.items) ?? []
  ).filter((message) => {
    const source = sourceFor(message.conversation_id);
    return source && matchesActivityFilters(
      filters, feedSearch, source.category, message.created_at ?? "",
      `${source.label} ${message.body}`,
    );
  });
  const ownEntries: ThreadFeedEntry[] = showOwnActivity
    ? (activity.data?.events ?? []).filter((event) => {
        const item = mapActivityEventsToDisplay(
          { ...activity.data!, events: [event] }, { timeBasis: timeSort },
        )[0];
        return item && matchesActivityItem(item, filters, feedSearch);
      }).map((event) => ({
        id: `event:${event.id}`,
        at: communicationActivityAt(event, timeSort),
        content: (
          <ActivityFeed
            chronological
            timeBasis={timeSort}
            data={{ ...activity.data!, events: [event] }}
            onOpenFormResponse={openFormResponse}
          />
        ),
      }))
    : [];

  const seenEvents = new Set(ownEntries.map((entry) => entry.id));
  const entries: ThreadFeedEntry[] = [...ownEntries];
  if (showEmails) {
    for (const email of emails.data?.pages.flatMap((page) => page.items) ?? []) {
      const participants = [email.sender, ...email.to, ...email.cc, ...email.bcc];
      const addresses = new Set(participants.map(emailAddress));
      const categories = new Set(
        contacts
          .filter((contact) => contact.email && addresses.has(emailAddress(contact.email)))
          .map((contact) => contact.kind),
      );
      if (!categories.size) categories.add(entityType);
      const at = email.sentAt ?? email.receivedAt ?? "";
      const text = [email.subject, email.bodyText, email.senderName, ...participants].join(" ");
      if (![...categories].some((category) =>
        matchesActivityFilters(filters, feedSearch, `email:${category}`, at, text),
      )) continue;
      entries.push({
        id: `email:${email.id}`,
        at,
        content: <EmailCorrespondenceCard message={email} />,
      });
    }
  }
  for (const { child, data } of childrenActivity.feeds) {
    for (const event of data.events) {
      const id = `event:${event.id}`;
      if (seenEvents.has(id)) continue;
      const item = mapActivityEventsToDisplay(
        { ...data, events: [event] }, { timeBasis: timeSort },
      )[0];
      if (!item || !matchesActivityItem(item, filters, feedSearch)) continue;
      seenEvents.add(id);
      entries.push({
        id,
        at: communicationActivityAt(event, timeSort),
        content: (
          <div>
            <p className="px-3 text-xs font-medium text-muted-foreground">
              {child.label} activity
            </p>
            <ActivityFeed
              chronological
              timeBasis={timeSort}
              data={{ ...data, events: [event] }}
              onOpenFormResponse={openFormResponse}
            />
          </div>
        ),
      });
    }
  }

  const waiting =
    (context.isLoading ||
      (showOwnActivity && activity.isLoading) ||
      childrenActivity.isLoading ||
      (showMessages && messages.isLoading) ||
      (showEmails && emails.isLoading)) &&
    visible.length === 0 &&
    entries.length === 0;
  const errorMessage =
    context.error?.message ||
    (showMessages ? messages.error?.message : "") ||
    (showEmails ? emails.error?.message : "") ||
    (showOwnActivity ? activity.error?.message : "") ||
    childrenActivity.error?.message ||
    "";

  const hasMore = Boolean(
    (showEmails && emails.hasNextPage) ||
    (showMessages && messages.hasNextPage) ||
    (showOwnActivity && activity.hasNextPage) ||
    childrenActivity.hasMore
  );
  const loadMore = () => {
    if (showEmails && emails.hasNextPage) void emails.fetchNextPage();
    if (showMessages && messages.hasNextPage) void messages.fetchNextPage();
    if (showOwnActivity && activity.hasNextPage) activity.fetchNextPage();
    if (childrenActivity.hasMore) childrenActivity.loadMore();
  };
  const { filtering, searching } = useActivityHistorySearch({
    filters, search: feedSearch, matches: visible.length + entries.length,
    cursor: [
      emails.data?.pages.length, messages.data?.pages.length, activity.data?.events.length,
      ...childrenActivity.feeds.map(({ data }) => data.events.length),
    ].join(":"),
    hasMore: hasMore && !errorMessage,
    pending: waiting || emails.isFetchingNextPage || messages.isFetchingNextPage ||
      activity.isFetchingNextPage || childrenActivity.isLoading,
    loadMore,
  });

  function recipientSourceId(id: string) {
    const groupConversation = conversations.find(
      (conversation) => conversation.id === id && conversation.is_group_chat,
    );
    return groupConversation
      ? groupConversationSourceId(groupConversation.id)
      : contactSourceId(id);
  }

  function selectRecipient(id: string) {
    setDestination(id);
    setPreferredSenderId(null);
    setSourceOverride((current) =>
      sourcesAfterRecipientChange(
        current ?? defaultSources,
        recipientSourceId(id),
      ),
    );
  }

  const modeControl = showActivity ? (
    allowForm
      ? <ComposeModeControl allowForm value={mode} onValueChange={setMode} />
      : <ComposeModeControl value={mode === "form" ? "message" : mode} onValueChange={setMode} />
  ) : undefined;

  const filterControl = (
    <CommunicationSourceFilter
      options={filterOptions}
      sources={sources}
      onToggle={(optionId, checked) => {
        if (checked && messageOnly) setFilters(({ from, to }) => ({
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        }));
        setSourceOverride((current) => {
          const base = current ?? sources;
          return checked
            ? base.includes(optionId)
              ? base
              : [...base, optionId]
            : base.filter((item) => item !== optionId);
        });
      }}
    />
  );

  const invalidateActivity = () => {
    void queryClient.invalidateQueries({
      queryKey: activityQueryKey(entityType, entityId),
    });
  };

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}
    >
      {renderHeader ? (
        renderHeader(filterControl)
      ) : (
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {recipients.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 max-w-full"
                  >
                    <MessageSquare className="mr-1 h-3 w-3 shrink-0" />
                    <span className="truncate text-xs">
                      {selectedRecipient?.label ?? "Select phone"}
                    </span>
                    {selectedRecipient?.detail ? (
                      <span className="ml-1 truncate text-xs text-muted-foreground">
                        • {selectedRecipient.detail}
                      </span>
                    ) : null}
                    <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {recipients.map((recipient) => (
                    <DropdownMenuItem
                      key={recipient.id}
                      onClick={() => selectRecipient(recipient.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {recipient.label}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {recipient.detail}
                          </span>
                        </div>
                      </div>
                      {selected === recipient.id ? (
                        <Check className="ml-2 h-4 w-4 shrink-0" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="truncate text-xs text-muted-foreground">
                No phone number
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {filterControl}
          </div>
        </div>
      )}

      <ActivityFeedToolbar
        className="shrink-0 border-b px-3 py-2"
        filters={filters}
        onFiltersChange={(next) => {
          if (next.type !== filters.type && filters.scope?.length) {
            const withoutScope = { ...next };
            delete withoutScope.scope;
            setFilters(withoutScope);
          } else {
            setFilters(next);
          }
        }}
        onViewApply={(next) => {
          setFilters(next);
          setSourceOverride(null);
        }}
        search={feedSearch}
        onSearchChange={setFeedSearch}
        kind="communication"
        timeBasis={timeSort}
        onTimeBasisChange={setTimeSort}
        direction="asc"
      />

      {errorMessage ? (
        <p
          role="alert"
          className="flex-shrink-0 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      {waiting ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <MessageThread
          isSearching={isSearching}
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
          onExitSearch={onExitSearch}
          onResentViaSms={setPreferredSenderId}
          feed={{
            key: `${entityType}:${entityId}:${timeSort}:${sources.join(",")}`,
            messages: visible,
            entries,
            emptyLabel: searching ? "Searching earlier activity…" : filtering ? "No matching activity." : "No activity yet.",
            loadMoreLabel: "Load earlier activity",
            hasMore: hasMore && !searching,
            loadMore,
            showConversationLabels:
              new Set(visible.map((message) => message.conversation_id)).size >
              1,
            labelForConversation: (id) => {
              const conversation = conversations.find((item) => item.id === id);
              if (!conversation) return undefined;
              if (conversation.is_group_chat)
                return conversation.group_chat_name ?? "Group";
              const person = contacts.find(
                (item) => item.id === conversation.contact_id,
              );
              if (!person) return undefined;
              return person.label;
            },
          }}
        />
      )}

      {showActivity && mode === "form" && allowForm ? (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t bg-background p-3">
          {modeControl}
          <FormResponsePicker respondent={{ type: entityType, id: entityId }} onSaved={invalidateActivity} />
        </div>
      ) : showActivity && mode === "note" ? (
        <div
          className="flex-shrink-0 border-t bg-background p-3"
          onKeyDownCapture={(event) => {
            if (
              !isMessageComposerSendShortcut(event) ||
              isTiptapContentEmpty(noteComposer.content)
            )
              return;
            event.preventDefault();
            void noteComposer.onSubmit();
          }}
        >
          <NoteComposerWithTemplate
            content={noteComposer.content}
            onChange={noteComposer.onChange}
            onSubmit={noteComposer.onSubmit}
            isSubmitting={noteComposer.isSubmitting}
            canPost={noteComposer.canPost}
            modeControl={modeControl}
          />
        </div>
      ) : viewingHistory ? (
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-background p-3">
          <p className="text-sm text-muted-foreground">
            Historical conversation. Select the current number to send new
            messages.
          </p>
          {modeControl}
        </div>
      ) : selected && (contact || group) ? (
        <Composer
          key={selected}
          contactId={contact?.id ?? null}
          conversationId={group?.id}
          groupChatId={group?.group_chat_id}
          preferredSenderId={preferredSenderId}
          initialSenderId={initialSenderId}
          initialDestinationAddress={
            contact?.id === initialContactId
              ? initialDestinationAddress
              : undefined
          }
          draft={draft}
          onDraftChange={onDraftChange}
          onDraftClear={onDraftClear}
          toolbarBeforeTemplate={modeControl}
          onQueued={() => {
            void context.refetch();
            void messages.refetch();
          }}
        />
      ) : (
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-background p-3">
          <p className="text-sm text-muted-foreground">
            Add a phone number to send a text.
          </p>
          {modeControl}
        </div>
      )}

      <FormResponseDialog
        response={selectedResponse}
        onClose={closeFormResponse}
        onUpdated={invalidateActivity}
        onDeleted={invalidateActivity}
      />
    </div>
  );
}

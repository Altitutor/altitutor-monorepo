"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { ArrowUpDown, Check, ChevronDown, MessageSquare } from "lucide-react";
import { cn } from "@/shared/utils";
import { useChildrenActivity } from "../hooks/useChildrenActivity";
import { CommunicationSourceFilter } from "./CommunicationSourceFilter";
import { Composer } from "@/features/messages/components/Composer";
import {
  MessageThread,
  type ThreadFeedEntry,
} from "@/features/messages/components/MessageThread";
import { ActivityFeed } from "./ActivityFeed";
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
  hasActivitySource,
  messageConversationSources,
  communicationActivityAt,
  communicationContactDetail,
  communicationFilterOptions,
  contactSourceId,
  defaultCommunicationSources,
  defaultRecipientId,
  groupConversationSourceId,
  messageSourceId,
  sourcesAfterRecipientChange,
  type CommunicationEntityType,
  type CommunicationTimeSort,
} from "../lib/entityCommunication";

interface EntityCommunicationPanelProps {
  entityType: CommunicationEntityType;
  entityId: string;
  enabled?: boolean;
  className?: string;
  initialContactId?: string;
  initialDestinationAddress?: string;
  initialSenderId?: string;
  defaultShowActivity?: boolean;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onExitSearch?: () => void;
  renderHeader?: (filterControl: ReactNode) => ReactNode;
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
  className,
  initialContactId,
  initialDestinationAddress,
  initialSenderId,
  defaultShowActivity = true,
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
  const [mode, setMode] = useState<ComposeMode>("message");
  const [timeSort, setTimeSort] = useState<CommunicationTimeSort>("logged");
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
  const messages = useEntityCommunicationMessages(conversations, enabled);
  const defaultSources = initialContactId
    ? [
        ...(defaultShowActivity ? [ACTIVITY_SOURCE_ID] : []),
        ...messageConversationSources(initialContactId),
      ]
    : defaultCommunicationSources({ entityType, contacts }).filter(
        (source) => defaultShowActivity || source !== ACTIVITY_SOURCE_ID,
      );
  const sources = sourceOverride ?? defaultSources;
  const showActivity = hasActivitySource(sources);
  const showOwnActivity = sources.includes(ACTIVITY_SOURCE_ID);
  const childrenActivity = useChildrenActivity(
    context.data?.children ?? [],
    sources,
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
    const conversation = conversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation) return entityType;
    return messageSourceId({
      conversation: {
        id: conversation.id,
        contactId: conversation.contact_id,
        isGroup: conversation.is_group_chat,
      },
      contact:
        contacts.find((item) => item.id === conversation.contact_id) ?? null,
    });
  }

  const visible = (
    messages.data?.pages.flatMap((page) => page.items) ?? []
  ).filter((message) => sources.includes(sourceFor(message.conversation_id)));
  const ownEntries: ThreadFeedEntry[] = showOwnActivity
    ? (activity.data?.events ?? []).map((event) => ({
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
  for (const { child, data } of childrenActivity.feeds) {
    for (const event of data.events) {
      const id = `event:${event.id}`;
      if (seenEvents.has(id)) continue;
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
      (messages.isLoading && conversations.length > 0)) &&
    visible.length === 0 &&
    entries.length === 0;
  const errorMessage =
    context.error?.message ||
    messages.error?.message ||
    (showOwnActivity ? activity.error?.message : "") ||
    childrenActivity.error?.message ||
    "";

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
    <ComposeModeControl value={mode} onValueChange={setMode} />
  ) : undefined;

  const filterControl = (
    <CommunicationSourceFilter
      compact={Boolean(renderHeader)}
      options={filterOptions}
      sources={sources}
      onToggle={(optionId, checked) =>
        setSourceOverride((current) => {
          const base = current ?? sources;
          return checked
            ? base.includes(optionId)
              ? base
              : [...base, optionId]
            : base.filter((item) => item !== optionId);
        })
      }
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 shrink-0">
                  <ArrowUpDown className="mr-1 h-3 w-3" />
                  <span className="text-xs">Sort</span>
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                  value={timeSort}
                  onValueChange={(value) => {
                    if (value === "logged" || value === "effective")
                      setTimeSort(value);
                  }}
                >
                  <DropdownMenuRadioItem value="logged">
                    Time logged
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="effective">
                    Effective time
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {filterControl}
          </div>
        </div>
      )}

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
            hasMore: Boolean(
              messages.hasNextPage ||
                (showOwnActivity && activity.hasNextPage) ||
                childrenActivity.hasMore,
            ),
            loadMore: () => {
              if (messages.hasNextPage) void messages.fetchNextPage();
              if (showOwnActivity && activity.hasNextPage)
                activity.fetchNextPage();
              if (childrenActivity.hasMore) childrenActivity.loadMore();
            },
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

      {showActivity && mode === "note" ? (
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
          initialDestinationAddress={contact?.id === initialContactId ? initialDestinationAddress : undefined}
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

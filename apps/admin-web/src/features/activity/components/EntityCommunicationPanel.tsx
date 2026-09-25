'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { ArrowUpDown, Check, ChevronDown, Filter, MessageSquare } from 'lucide-react';
import { Composer } from '@/features/messages/components/Composer';
import {
  MessageThread,
  type ThreadFeedEntry,
} from '@/features/messages/components/MessageThread';
import { ActivityFeed } from './ActivityFeed';
import { ComposeModeControl, type ComposeMode } from './ComposeModeControl';
import { NoteComposerWithTemplate } from '@/shared/components/NoteComposerWithTemplate';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';
import { isMessageComposerSendShortcut } from '@/features/messages/utils/composerShortcut';
import {
  getMessagingDraftKey,
  usePersistedConversationDraft,
} from '@/features/messages/state/messagingUiStore';
import {
  useParentActivity,
  useStaffActivity,
  useStudentActivity,
  useFormResponseDialog,
  useEntityActivityNoteComposer,
  activityKeys,
} from '../hooks';
import {
  useEntityCommunicationContext,
  useEntityCommunicationMessages,
  type EntityCommunicationContact,
} from '../hooks/useEntityCommunication';
import {
  ACTIVITY_SOURCE_ID,
  communicationActivityAt,
  communicationFilterOptions,
  contactSourceId,
  defaultCommunicationSources,
  defaultRecipientId,
  groupConversationSourceId,
  messageSourceId,
  sourcesAfterRecipientChange,
  type CommunicationEntityType,
  type CommunicationTimeSort,
} from '../lib/entityCommunication';

interface EntityCommunicationPanelProps {
  entityType: CommunicationEntityType;
  entityId: string;
  enabled?: boolean;
}

function activityQueryKey(entityType: CommunicationEntityType, entityId: string) {
  if (entityType === 'student') return activityKeys.student(entityId);
  if (entityType === 'staff') return activityKeys.staff(entityId);
  return activityKeys.parent(entityId);
}

function recipientDetail(contact: EntityCommunicationContact, entityType: CommunicationEntityType): string {
  const handle = contact.phoneE164 || contact.email || contact.kind;
  if (contact.kind === entityType && !contact.isCurrent) return `${handle} · historical`;
  return handle;
}

export function EntityCommunicationPanel({
  entityType,
  entityId,
  enabled = true,
}: EntityCommunicationPanelProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ComposeMode>('message');
  const [timeSort, setTimeSort] = useState<CommunicationTimeSort>('logged');
  const [sourceOverride, setSourceOverride] = useState<string[] | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const context = useEntityCommunicationContext(entityType, entityId, enabled);
  const contacts = useMemo(() => context.data?.contacts ?? [], [context.data?.contacts]);
  const conversations = useMemo(
    () => context.data?.conversations ?? [],
    [context.data?.conversations],
  );
  const messages = useEntityCommunicationMessages(conversations, enabled);
  const studentActivity = useStudentActivity(entityType === 'student' ? entityId : null, enabled);
  const staffActivity = useStaffActivity(entityType === 'staff' ? entityId : null, enabled);
  const parentActivity = useParentActivity(entityType === 'parent' ? entityId : null, enabled);
  const activity =
    entityType === 'student' ? studentActivity : entityType === 'staff' ? staffActivity : parentActivity;
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();
  const noteComposer = useEntityActivityNoteComposer({
    targetType: entityType,
    targetId: entityId,
    activityQueryKey: activityQueryKey(entityType, entityId),
  });

  const sources =
    sourceOverride ??
    defaultCommunicationSources({ entityType, contacts });
  const filterOptions = communicationFilterOptions({
    contacts: contacts.map((person) => ({
      ...person,
      detail: recipientDetail(person, entityType),
    })),
    groups: conversations
      .filter((conversation) => conversation.is_group_chat)
      .map((conversation) => ({
        id: conversation.id,
        label: conversation.group_chat_name || 'Group texts',
      })),
  });
  const selected =
    destination ?? defaultRecipientId({ entityType, contacts });
  const contact = contacts.find((item) => item.id === selected) ?? null;
  const group = conversations.find(
    (conversation) => conversation.id === selected && conversation.is_group_chat,
  );
  const viewingHistory = Boolean(contact && contact.kind === entityType && !contact.isCurrent);

  const recipients = useMemo(
    () => [
      ...contacts.map((person) => ({
        id: person.id,
        label: person.label,
        detail: recipientDetail(person, entityType),
      })),
      ...conversations
        .filter((conversation) => conversation.is_group_chat)
        .map((conversation) => ({
          id: conversation.id,
          label: conversation.group_chat_name || 'Existing group',
          detail: 'Group',
        })),
    ],
    [contacts, conversations, entityType],
  );
  const selectedRecipient = recipients.find((recipient) => recipient.id === selected);

  const draftKey =
    mode === 'message'
      ? getMessagingDraftKey(
          group
            ? { kind: 'group', conversationId: group.id }
            : { kind: 'contact', contactId: contact?.id ?? null },
        )
      : null;
  const {
    draft,
    onDraftChange,
    onDraftClear,
  } = usePersistedConversationDraft(draftKey);

  function sourceFor(conversationId: string) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return entityType;
    return messageSourceId({
      conversation: {
        id: conversation.id,
        contactId: conversation.contact_id,
        isGroup: conversation.is_group_chat,
      },
      contact: contacts.find((item) => item.id === conversation.contact_id) ?? null,
    });
  }

  const visible = (messages.data?.pages.flatMap((page) => page.items) ?? []).filter((message) =>
    sources.includes(sourceFor(message.conversation_id)),
  );
  const entries: ThreadFeedEntry[] = sources.includes(ACTIVITY_SOURCE_ID)
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

  const waiting =
    (context.isLoading || activity.isLoading || (messages.isLoading && conversations.length > 0)) &&
    visible.length === 0 &&
    entries.length === 0;
  const errorMessage =
    context.error?.message || messages.error?.message || activity.error?.message || '';

  function recipientSourceId(id: string) {
    const groupConversation = conversations.find(
      (conversation) => conversation.id === id && conversation.is_group_chat,
    );
    return groupConversation ? groupConversationSourceId(groupConversation.id) : contactSourceId(id);
  }

  function selectRecipient(id: string) {
    setDestination(id);
    setSourceOverride((current) =>
      sourcesAfterRecipientChange(
        current ?? defaultCommunicationSources({ entityType, contacts }),
        recipientSourceId(id),
      ),
    );
  }

  const modeControl = <ComposeModeControl value={mode} onValueChange={setMode} />;

  const invalidateActivity = () => {
    void queryClient.invalidateQueries({ queryKey: activityQueryKey(entityType, entityId) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {recipients.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 max-w-full">
                  <MessageSquare className="mr-1 h-3 w-3 shrink-0" />
                  <span className="truncate text-xs">
                    {selectedRecipient?.label ?? 'Select phone'}
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
                        <span className="truncate text-sm font-medium">{recipient.label}</span>
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
            <span className="truncate text-xs text-muted-foreground">No phone number</span>
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
                  if (value === 'logged' || value === 'effective') setTimeSort(value);
                }}
              >
                <DropdownMenuRadioItem value="logged">Time logged</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="effective">Effective time</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 shrink-0">
                <Filter className="mr-1 h-3 w-3" />
                <span className="text-xs">Filter</span>
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {filterOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={sources.includes(option.id)}
                  onCheckedChange={(checked) =>
                    setSourceOverride((current) => {
                      const base = current ?? sources;
                      return checked
                        ? base.includes(option.id)
                          ? base
                          : [...base, option.id]
                        : base.filter((item) => item !== option.id);
                    })
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="flex-shrink-0 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {waiting ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <MessageThread
          hideAddIssueHover
          feed={{
            key: `${entityType}:${entityId}:${timeSort}`,
            messages: visible,
            entries,
            hasMore: Boolean(messages.hasNextPage || activity.hasNextPage),
            loadMore: () => {
              if (messages.hasNextPage) void messages.fetchNextPage();
              if (activity.hasNextPage) activity.fetchNextPage();
            },
            labelForConversation: (id) => {
              const conversation = conversations.find((item) => item.id === id);
              if (!conversation) return undefined;
              if (conversation.is_group_chat) return conversation.group_chat_name ?? 'Group';
              const person = contacts.find((item) => item.id === conversation.contact_id);
              if (!person) return undefined;
              return person.label;
            },
          }}
        />
      )}

      {mode === 'note' ? (
        <div
          className="flex-shrink-0 border-t bg-background p-3"
          onKeyDownCapture={(event) => {
            if (!isMessageComposerSendShortcut(event) || isTiptapContentEmpty(noteComposer.content)) return;
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
            Historical conversation. Select the current number to send new messages.
          </p>
          {modeControl}
        </div>
      ) : selected && (contact || group) ? (
        <Composer
          key={selected}
          contactId={contact?.id ?? null}
          conversationId={group?.id}
          groupChatId={group?.group_chat_id}
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

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityFeed } from '../components/ActivityFeed';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';
import type { ThreadMessage } from '@/features/messages/api/queries';
import type { ThreadFeedEntry } from '@/features/messages/components/MessageThread';
import { activityKeys, useParentActivity, useStaffActivity, useStudentActivity } from './useActivityEvents';
import { useFormResponseDialog } from './useFormResponseDialog';
import {
  useEntityCommunicationContext,
  useEntityCommunicationMessages,
} from './useEntityCommunication';
import {
  ACTIVITY_SOURCE_ID,
  communicationActivityAt,
  communicationContactDetail,
  communicationFilterOptions,
  messageConversationSources,
  messageSourceId,
  type CommunicationEntityType,
} from '../lib/entityCommunication';

export function linkedConversationEntity(contact: {
  contact_type?: string | null;
  students?: { id: string } | null;
  parents?: { id: string } | null;
  staff?: { id: string } | null;
} | null | undefined): { type: CommunicationEntityType; id: string } | null {
  if (!contact) return null;
  if (contact.contact_type === 'STUDENT' && contact.students?.id) {
    return { type: 'student', id: contact.students.id };
  }
  if (contact.contact_type === 'PARENT' && contact.parents?.id) {
    return { type: 'parent', id: contact.parents.id };
  }
  if (contact.contact_type === 'STAFF' && contact.staff?.id) {
    return { type: 'staff', id: contact.staff.id };
  }
  return null;
}

function activityQueryKey(entityType: CommunicationEntityType, entityId: string) {
  if (entityType === 'student') return activityKeys.student(entityId);
  if (entityType === 'staff') return activityKeys.staff(entityId);
  return activityKeys.parent(entityId);
}

export function useConversationCommunicationFeed({
  entityType,
  entityId,
  contactId,
  enabled,
}: {
  entityType: CommunicationEntityType | null;
  entityId: string | null;
  contactId: string | null;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const active = enabled && Boolean(entityType && entityId && contactId);
  const type = entityType ?? 'student';
  const id = entityId ?? '';
  const [selection, setSelection] = useState<{ contactId: string | null; sources: string[] | null }>({
    contactId: null,
    sources: null,
  });
  const context = useEntityCommunicationContext(type, id, active);
  const contacts = useMemo(() => context.data?.contacts ?? [], [context.data?.contacts]);
  const conversations = useMemo(
    () => context.data?.conversations ?? [],
    [context.data?.conversations],
  );
  const messages = useEntityCommunicationMessages(conversations, active);
  const studentActivity = useStudentActivity(type === 'student' ? id : null, active && type === 'student');
  const staffActivity = useStaffActivity(type === 'staff' ? id : null, active && type === 'staff');
  const parentActivity = useParentActivity(type === 'parent' ? id : null, active && type === 'parent');
  const activity = type === 'student' ? studentActivity : type === 'staff' ? staffActivity : parentActivity;
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();

  const override = selection.contactId === contactId ? selection.sources : null;
  const sources = override ?? (contactId ? messageConversationSources(contactId) : []);
  const filterOptions = communicationFilterOptions({
    contacts: contacts.map((person) => ({
      ...person,
      detail: communicationContactDetail(person, type),
    })),
    groups: conversations
      .filter((conversation) => conversation.is_group_chat)
      .map((conversation) => ({
        id: conversation.id,
        label: conversation.group_chat_name || 'Group texts',
      })),
  });

  function sourceFor(conversationId: string) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return type;
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
        at: communicationActivityAt(event, 'logged'),
        content: (
          <ActivityFeed
            chronological
            timeBasis="logged"
            data={{ ...activity.data!, events: [event] }}
            onOpenFormResponse={openFormResponse}
          />
        ),
      }))
    : [];

  const showActivity = sources.includes(ACTIVITY_SOURCE_ID);
  const waiting =
    active &&
    (context.isLoading ||
      (showActivity && activity.isLoading) ||
      (messages.isLoading && conversations.length > 0)) &&
    visible.length === 0 &&
    entries.length === 0;

  function toggleSource(sourceId: string, checked: boolean) {
    setSelection({
      contactId,
      sources: checked
        ? sources.includes(sourceId)
          ? sources
          : [...sources, sourceId]
        : sources.filter((item) => item !== sourceId),
    });
  }

  function loadMore() {
    if (messages.hasNextPage) void messages.fetchNextPage();
    if (activity.hasNextPage) activity.fetchNextPage();
  }

  const formDialog: ReactNode = (
    <FormResponseDialog
      response={selectedResponse}
      onClose={closeFormResponse}
      onUpdated={() => {
        void queryClient.invalidateQueries({ queryKey: activityQueryKey(type, id) });
      }}
      onDeleted={() => {
        void queryClient.invalidateQueries({ queryKey: activityQueryKey(type, id) });
      }}
    />
  );

  return {
    filterOptions,
    sources,
    toggleSource,
    messages: visible as ThreadMessage[],
    entries,
    hasMore: Boolean(messages.hasNextPage || activity.hasNextPage),
    loadMore,
    waiting,
    errorMessage:
      context.error?.message ||
      messages.error?.message ||
      (showActivity ? activity.error?.message : '') ||
      '',
    labelForConversation: (conversationId: string) => {
      const conversation = conversations.find((item) => item.id === conversationId);
      if (!conversation) return undefined;
      if (conversation.is_group_chat) return conversation.group_chat_name ?? 'Group';
      const person = contacts.find((item) => item.id === conversation.contact_id);
      return person?.label;
    },
    formDialog,
  };
}

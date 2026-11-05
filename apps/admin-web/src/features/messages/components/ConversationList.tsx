'use client';

import { useEffect, useState, useMemo, useId, type ReactNode } from 'react';
import { useActiveAdminStaff, useAvailableSenders, useConversationList } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatContactName } from '../utils/formatContactName';
import { formatConversationDate } from '../utils/formatDate';
import {
  Button,
  DataTableToolbar,
  useToast,
} from '@altitutor/ui';
import { Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils';
import { messagesKeys } from '../api/queryKeys';
import { NewConversationDialog } from './NewConversationDialog';
import { useAssignConversations, useMarkConversationRead, useMarkUnread, useMarkRead, useMarkContactUnread } from '../api/mutations';
import { ConversationRowActions } from './ConversationRowActions';
import { useMessagingListFilters, type MessagingFilterScope } from '../state/messagingUiStore';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { AdminPageActions } from '@/shared/components/AdminPageActions';
import { matchesConversationListQuery } from '../utils/conversationListQuery';
import { CONVERSATION_LIST_COLUMNS, conversationListViews } from '../utils/conversationListViews';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AggregatedConversation,
  ConversationListItem,
  ConversationMessagePreview,
  ConversationSelection,
} from '../types';

interface Props {
  activeSelection?: ConversationSelection | null;
  onSelect: (selection: ConversationSelection) => void;
  filterScope: MessagingFilterScope;
  /** The messages page puts compose in the breadcrumb header. Other surfaces keep it beside the list. */
  composePlacement?: 'header' | 'list';
}

export function ConversationList({
  activeSelection,
  onSelect,
  filterScope,
  composePlacement = 'list',
}: Props) {
  const { ownedNumberFilter: selectedOwnedNumberId } = useMessagingListFilters(filterScope);
  const { data: currentStaff } = useCurrentStaff();
  const quickActions = useQuickActions();
  const { data: senders = [] } = useAvailableSenders();
  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters: {},
    defaultSort: { field: 'latest', direction: 'desc' },
    defaultVisibleColumns: [...CONVERSATION_LIST_COLUMNS],
    filterKeys: ['read', 'reply', 'followUp', 'assignee', 'recipient', 'from'],
    skipUrlSync: true,
  });
  const { data } = useConversationList(selectedOwnedNumberId);
  const qc = useQueryClient();
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const { toast } = useToast();
  const { data: adminStaff = [], isLoading: adminStaffLoading } = useActiveAdminStaff();
  const markUnreadMutation = useMarkUnread();
  const markReadMutation = useMarkRead();
  const markContactUnreadMutation = useMarkContactUnread();
  const markConversationReadMutation = useMarkConversationRead();
  const assignConversations = useAssignConversations();
  const assignUnread = (conversationIds: string[], staffId: string | null) => {
    assignConversations.mutate(
      { conversationIds, staffId },
      {
        onError: (error: Error) => {
          toast({
            title: 'Could not assign conversation',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };
  const channelNonce = useId().replace(/:/g, '');

  useEffect(() => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const channel = supabase
      .channel(`conversations-list-${channelNonce}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
        qc.invalidateQueries({ queryKey: messagesKeys.conversations() }); // Also invalidate old for backward compat
        qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
        qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, channelNonce]);

  // Check if aggregated conversation is unread (has unreadCount > 0)
  const isUnread = (aggregated: AggregatedConversation) => {
    return aggregated.unreadCount > 0;
  };
  
  // Unreplied means the latest real message is inbound. Tapbacks do not count.
  const isUnreplied = (item: { latestMessage: { countsAsUnreplied: boolean } | null }) => {
    return item.latestMessage?.countsAsUnreplied === true;
  };

  // Check if any conversation for this contact needs follow up (outbound with ? and no inbound after)
  const isToFollowUp = (aggregated: AggregatedConversation) => {
    return aggregated.conversations.some((c) => c.needs_follow_up);
  };

  const filteredItems = useMemo(() => {
    const items: ConversationListItem[] = data || [];
    return items.filter((conversation) => {
      if (selectedOwnedNumberId) {
        const matchesNumber = conversation.kind === 'group'
          ? conversation.ownedNumberId === selectedOwnedNumberId
          : conversation.conversations.some((item) => item.owned_number_id === selectedOwnedNumberId);
        if (!matchesNumber) return false;
      }
      if (conversation.kind === 'group') {
        return matchesConversationListQuery({
          names: [conversation.groupName ?? 'Group chat', ...conversation.participantNames],
          phones: [],
          unread: conversation.unreadCount > 0,
          unreplied: isUnreplied(conversation),
          followUp: false,
          assignedStaffId: conversation.assignedStaffId,
          recipientType: null,
          ownedNumberIds: [conversation.ownedNumberId],
        }, { search: state.search, filters: state.filters, staffId: currentStaff?.id ?? null });
      }
      const latestOwnedNumberId = [...conversation.conversations].sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))[0]?.owned_number_id;
      return matchesConversationListQuery({
        names: [formatContactName({ contacts: conversation.contact })],
        phones: [conversation.contact?.phone_e164 ?? ''],
        unread: isUnread(conversation),
        unreplied: isUnreplied(conversation),
        followUp: isToFollowUp(conversation),
        assignedStaffId: conversation.assignedStaffId,
        recipientType: conversation.contact?.contact_type ?? null,
        ownedNumberIds: latestOwnedNumberId ? [latestOwnedNumberId] : conversation.conversations.map((item) => item.owned_number_id),
      }, { search: state.search, filters: state.filters, staffId: currentStaff?.id ?? null });
    });
  }, [data, selectedOwnedNumberId, state.search, state.filters, currentStaff?.id]);

  const handleNewConversation = async (conversationId: string, destinationAddress?: string, senderId?: string) => {
    // Get contactId from conversation
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', conversationId)
      .maybeSingle();
    
    if (conv?.contact_id) {
      onSelect({ kind: 'contact', contactId: conv.contact_id, destinationAddress, senderId });
    }
    setIsNewConversationDialogOpen(false);
    // Invalidate conversations to refresh the list
    qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
    qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
    qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
  };

  const show = (column: (typeof CONVERSATION_LIST_COLUMNS)[number]) => state.visibleColumns.includes(column);
  const openTask = (messageId: string | undefined, label: string) => {
    if (!messageId) return;
    quickActions.openCreateTaskDialog({ type: 'message', id: messageId, label });
  };
  const composeButton = (
    <Button onClick={() => setIsNewConversationDialogOpen(true)} size="sm" variant="default">
      <Plus className="mr-2 h-4 w-4" />
      New conversation
    </Button>
  );

  return (
    <div className="h-full border-r dark:border-brand-dark-border flex flex-col">
      {composePlacement === 'header' ? <AdminPageActions>{composeButton}</AdminPageActions> : null}
      <div data-pane-toolbar className="flex items-center gap-2 px-3 pt-3">
        <DataTableToolbar
          className="min-w-0 flex-1"
          compact={composePlacement === 'list'}
          viewTarget="messages"
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={(filter) => applyQuickFilter(filter, currentStaff?.id)}
          onReset={resetFilters}
          quickFilters={conversationListViews}
          filterDefinitions={[
            { key: 'recipient', label: 'Recipient', options: [
              { label: 'Student', value: 'STUDENT' },
              { label: 'Parent', value: 'PARENT' },
              { label: 'Staff', value: 'STAFF' },
            ] },
            { key: 'read', label: 'Read', options: [
              { label: 'Unread', value: 'unread' },
              { label: 'Read', value: 'read' },
            ] },
            { key: 'reply', label: 'Reply', options: [
              { label: 'Unreplied', value: 'unreplied' },
              { label: 'Replied', value: 'replied' },
            ] },
            { key: 'from', label: 'From number', options: senders.map((sender) => ({
              label: sender.label || sender.phone_e164 || sender.alphanumeric_sender_id || 'Number',
              value: sender.id,
            })) },
          ]}
          columnDefinitions={CONVERSATION_LIST_COLUMNS.map((key) => ({
            key,
            label: key === 'timestamp' ? 'Time' : key[0].toUpperCase() + key.slice(1),
            visibleByDefault: true,
          }))}
          searchPlaceholder="Search conversations"
        />
        {composePlacement === 'list' ? composeButton : null}
      </div>
      
      <div className="flex-1 overflow-y-auto divide-y dark:divide-brand-dark-border">
        {filteredItems.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {state.search ? 'No conversations found.' : 'No conversations yet.'}
          </div>
        ) : (
          filteredItems.map((aggregated) => {
            if (aggregated.kind === 'group') {
              const isActive =
                activeSelection?.kind === 'group' &&
                activeSelection.conversationId === aggregated.conversationId;
              const title = aggregated.groupName || 'Group chat';
              const participants = aggregated.participantNames.length
                ? aggregated.participantNames.join(', ')
                : 'Participants unavailable';

              return (
                <div
                  key={aggregated.conversationId}
                  data-conversation-row
                  className={`group relative w-full ${isActive ? 'md:bg-muted' : ''}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className={`w-full p-3 text-left hover:bg-muted cursor-pointer ${isActive ? 'md:bg-muted' : ''}`}
                    onClick={() => onSelect({ kind: 'group', conversationId: aggregated.conversationId })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect({ kind: 'group', conversationId: aggregated.conversationId });
                      }
                    }}
                  >
                    <ConversationRow
                      title={title}
                      subtitle={participants}
                      sender={senderLabel(senders, [aggregated.ownedNumberId])}
                      preview={aggregated.latestMessage?.preview ?? null}
                      at={aggregated.latestMessageAt}
                      show={show}
                      actions={
                        <ConversationRowActions
                          unread={aggregated.unreadCount > 0}
                          staff={adminStaff}
                          staffLoading={adminStaffLoading}
                          assigneeId={aggregated.assignedStaffId}
                          onCreateTask={() => openTask(aggregated.latestMessage?.id, title)}
                          onMarkRead={() => {
                            const lastMessageId = aggregated.latestMessage?.id;
                            if (!lastMessageId) return;
                            markConversationReadMutation.mutate({
                              conversationId: aggregated.conversationId,
                              lastMessageId,
                            });
                          }}
                          onMarkUnread={() => markUnreadMutation.mutate(aggregated.conversationId)}
                          onAssign={(staffId) => assignUnread(aggregated.conversationIds, staffId)}
                        />
                      }
                    />
                  </div>
                </div>
              );
            }

            const title = formatContactName({ contacts: aggregated.contact });
            const isActive = activeSelection?.kind === 'contact' && aggregated.contactId === activeSelection.contactId;
            const isUnreadConv = isUnread(aggregated);

            const latestConversation = [...aggregated.conversations].sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))[0];
            return (
              <div
                key={aggregated.contactId}
                data-conversation-row
                className={`group relative w-full ${isActive ? 'md:bg-muted' : ''}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className={`w-full text-left p-3 hover:bg-muted cursor-pointer ${isActive ? 'md:bg-muted' : ''}`}
                  onClick={() => onSelect({ kind: 'contact', contactId: aggregated.contactId })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect({ kind: 'contact', contactId: aggregated.contactId });
                    }
                  }}
                >
                  <ConversationRow
                    title={title}
                    sender={senderLabel(senders, latestConversation ? [latestConversation.owned_number_id] : [])}
                    preview={aggregated.latestMessage?.preview ?? null}
                    at={aggregated.latestMessageAt}
                    show={show}
                    actions={
                      <ConversationRowActions
                        unread={isUnreadConv}
                        staff={adminStaff}
                        staffLoading={adminStaffLoading}
                        assigneeId={aggregated.assignedStaffId}
                        onCreateTask={() => openTask(aggregated.latestMessage?.id, title)}
                        onMarkRead={() => {
                          const lastMessageId = aggregated.latestMessage?.id;
                          if (!lastMessageId) return;
                          markReadMutation.mutate({ contactId: aggregated.contactId, lastMessageId });
                        }}
                        onMarkUnread={() => markContactUnreadMutation.mutate(aggregated.contactId)}
                        onAssign={(staffId) => assignUnread(aggregated.conversationIds, staffId)}
                      />
                    }
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <NewConversationDialog
        isOpen={isNewConversationDialogOpen}
        onClose={() => setIsNewConversationDialogOpen(false)}
        onConversationSelected={handleNewConversation}
        ownedNumberId={selectedOwnedNumberId}
      />
    </div>
  );
}

function senderLabel(senders: Array<{ id: string; label: string | null; phone_e164: string | null; alphanumeric_sender_id: string | null }>, ids: string[]): string {
  const sender = senders.find((item) => ids.includes(item.id));
  return sender?.label || sender?.phone_e164 || sender?.alphanumeric_sender_id || '';
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function ConversationRow({
  title,
  subtitle,
  sender,
  preview,
  at,
  show,
  actions,
}: {
  title: string;
  subtitle?: string;
  sender: string;
  preview: ConversationMessagePreview | null;
  at: string | null;
  show: (column: (typeof CONVERSATION_LIST_COLUMNS)[number]) => boolean;
  actions: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {show('avatar') ? (
        <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {initials(title) || '?'}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {show('name') ? <div className="truncate text-sm font-medium">{title}</div> : null}
            {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
            {show('sender') && sender ? <div className="truncate text-xs text-muted-foreground">{sender}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {show('timestamp') ? <ListTimestamp iso={at} /> : null}
            {actions}
          </div>
        </div>
        {show('preview') ? <ConversationPreviewText preview={preview} /> : null}
      </div>
    </div>
  );
}

function ListTimestamp({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const time = new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      {formatConversationDate(iso)} {time}
    </span>
  );
}

function ConversationPreviewText({ preview }: { preview: ConversationMessagePreview | null }) {
  if (!preview) return null;
  const fromContact = preview.direction === 'INBOUND';
  return (
    <p
      className="line-clamp-2 break-words text-xs leading-4 text-muted-foreground"
      title={preview.text}
    >
      {preview.failed && (
        <span className="mr-1 inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 text-destructive align-middle">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Failed
        </span>
      )}
      <span
        className={cn(
          'mr-1 inline rounded px-1 font-medium',
          fromContact
            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        )}
      >
        {preview.senderName}:
      </span>
      {preview.text}
    </p>
  );
}



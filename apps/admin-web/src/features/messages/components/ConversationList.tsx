'use client';

import { useEffect, useState, useMemo, useId } from 'react';
import { useConversationList } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatContactName } from '../utils/formatContactName';
import { formatConversationDate } from '../utils/formatDate';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { Plus, Mail, Filter, Search, X, Check } from 'lucide-react';
import { cn } from '@/shared/utils';
import { messagesKeys } from '../api/queryKeys';
import { NewConversationDialog } from './NewConversationDialog';
import { useMarkConversationRead, useMarkUnread, useMarkRead, useMarkContactUnread } from '../api/mutations';
import { useMessagingListFilters, type ConversationListFilter, type MessagingFilterScope } from '../state/messagingUiStore';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AggregatedConversation,
  ConversationListItem,
  ConversationMessagePreview,
  ConversationSelection,
} from '../types';

type FilterOption = ConversationListFilter;
const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'unreplied', label: 'Unreplied' },
  { value: 'to_follow_up', label: 'To follow up' },
];

interface Props {
  activeSelection?: ConversationSelection | null;
  onSelect: (selection: ConversationSelection) => void;
  filterScope: MessagingFilterScope;
}

export function ConversationList({
  activeSelection,
  onSelect,
  filterScope,
}: Props) {
  const {
    listFilter: activeFilter,
    ownedNumberFilter: selectedOwnedNumberId,
    setListFilter: setActiveFilter,
  } = useMessagingListFilters(filterScope);
  const { data } = useConversationList(selectedOwnedNumberId);
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const markUnreadMutation = useMarkUnread();
  const markReadMutation = useMarkRead();
  const markContactUnreadMutation = useMarkContactUnread();
  const markConversationReadMutation = useMarkConversationRead();
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
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

  // Normalize Australian phone numbers for search comparison
  // Converts +61478778288 and 0478778288 to the same format for matching
  const normalizePhoneForSearch = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Convert +61 or 61 prefix to 0 prefix (Australian format)
    if (digits.startsWith('61') && digits.length >= 10) {
      // +61478778288 (11 digits) -> 0478778288
      // Also handle partial matches like 6147877 (7 digits starting with 61)
      return '0' + digits.substring(2);
    }
    // If it's 9 digits without leading 0, assume it's missing the 0
    if (digits.length === 9 && !digits.startsWith('0')) {
      return '0' + digits;
    }
    return digits;
  };

  // Filter conversations by contact name/phone or filter pills
  const filteredItems = useMemo(() => {
    const items: ConversationListItem[] = data || [];
    let filtered = items;

    if (selectedOwnedNumberId) {
      filtered = filtered.filter((conversation) =>
        conversation.kind === 'group'
          ? conversation.ownedNumberId === selectedOwnedNumberId
          : conversation.conversations.some((c) => c.owned_number_id === selectedOwnedNumberId)
      );
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const normalizedSearch = normalizePhoneForSearch(searchTerm);
      filtered = filtered.filter((c) => {
        if (c.kind === 'group') {
          return (
            (c.groupName ?? 'Group chat').toLowerCase().includes(search) ||
            c.participantNames.some((participant) => participant.toLowerCase().includes(search))
          );
        }
        const contactName = formatContactName({ contacts: c.contact });
        const phoneNumber = c.contact?.phone_e164 || '';
        const normalizedPhone = normalizePhoneForSearch(phoneNumber);
        
        // Match by name (case-insensitive)
        if (contactName.toLowerCase().includes(search)) {
          return true;
        }
        
        // Match by phone number (original format)
        if (phoneNumber.toLowerCase().includes(search)) {
          return true;
        }
        
        // Match by normalized phone number (handles +61 vs 0 format differences)
        if (normalizedSearch && normalizedPhone && normalizedPhone.includes(normalizedSearch)) {
          return true;
        }
        
        return false;
      });
    } else {
      // Only apply filter pills when not searching
      if (activeFilter === 'unread') {
        filtered = filtered.filter((c) => c.kind === 'group' ? c.unreadCount > 0 : isUnread(c));
      } else if (activeFilter === 'unreplied') {
        filtered = filtered.filter((c) => isUnreplied(c));
      } else if (activeFilter === 'to_follow_up') {
        filtered = filtered.filter((c) => c.kind === 'contact' && isToFollowUp(c));
      }
    }
    
    return filtered;
  }, [data, searchTerm, activeFilter, selectedOwnedNumberId]);

  const activeFilterLabel = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return 'Unread';
      case 'unreplied':
        return 'Unreplied';
      case 'to_follow_up':
        return 'To follow up';
      default:
        return 'All';
    }
  }, [activeFilter]);

  const hasAnyFiltersApplied = activeFilter !== 'all';

  const handleNewConversation = async (conversationId: string) => {
    // Get contactId from conversation
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', conversationId)
      .maybeSingle();
    
    if (conv?.contact_id) {
      onSelect({ kind: 'contact', contactId: conv.contact_id });
    }
    setIsNewConversationDialogOpen(false);
    // Invalidate conversations to refresh the list
    qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
    qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
    qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
  };

  return (
    <div className="h-full border-r dark:border-brand-dark-border flex flex-col">
      <div data-pane-toolbar className="p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Search bar - styled like searchable-select-inline */}
          <div className="flex flex-1 min-w-0 items-center rounded-md border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search conversations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu open={isFilterMenuOpen} onOpenChange={setIsFilterMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-10 px-2 flex-shrink-0 gap-1"
              >
                <Filter className="h-4 w-4" />
                <span className="text-xs">{activeFilterLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {FILTER_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="flex items-center justify-between"
                  onClick={() => {
                    setActiveFilter(option.value);
                    setIsFilterMenuOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {activeFilter === option.value ? (
                    <Check className="ml-2 h-4 w-4 shrink-0" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {hasAnyFiltersApplied && (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 flex-shrink-0"
              title="Clear filters"
              onClick={() => setActiveFilter('all')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={() => setIsNewConversationDialogOpen(true)}
            size="icon"
            variant="default"
            className="h-9 w-9 flex-shrink-0"
            title="New Conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto divide-y dark:divide-brand-dark-border">
        {filteredItems.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {searchTerm ? 'No conversations found.' : 'No conversations yet.'}
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
                  className={`relative w-full ${isActive ? 'md:bg-muted' : ''}`}
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium min-w-0">{title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">Group</Badge>
                        <ListTimestamp iso={aggregated.latestMessageAt} />
                        {aggregated.latestMessage?.id && (
                          <Button
                            size="sm"
                            variant={aggregated.unreadCount > 0 ? 'default' : 'outline'}
                            className={cn(
                              'h-6 w-6 p-0 transition-none',
                              aggregated.unreadCount > 0 && 'bg-red-500 text-white hover:bg-red-600'
                            )}
                            title={aggregated.unreadCount > 0 ? 'Mark as read for me' : 'Mark as unread for me'}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (aggregated.unreadCount > 0) {
                                markConversationReadMutation.mutate({
                                  conversationId: aggregated.conversationId,
                                  lastMessageId: aggregated.latestMessage!.id,
                                });
                              } else {
                                markUnreadMutation.mutate(aggregated.conversationId);
                              }
                            }}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{participants}</div>
                    <ConversationPreviewText preview={aggregated.latestMessage?.preview ?? null} />
                  </div>
                </div>
              );
            }

            const title = formatContactName({ contacts: aggregated.contact });
            const isActive = activeSelection?.kind === 'contact' && aggregated.contactId === activeSelection.contactId;
            const isUnreadConv = isUnread(aggregated);

            const handleToggleRead = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (isUnreadConv) {
                const lastMessageId = aggregated.latestMessage?.id;
                if (lastMessageId) {
                  markReadMutation.mutate({ contactId: aggregated.contactId, lastMessageId });
                }
              } else {
                markContactUnreadMutation.mutate(aggregated.contactId);
              }
            };

            return (
              <div
                key={aggregated.contactId}
                className={`relative w-full ${isActive ? 'md:bg-muted' : ''}`}
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
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{title}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ListTimestamp iso={aggregated.latestMessageAt} />
                      <Button
                        size="sm"
                        variant={isUnreadConv ? 'default' : 'outline'}
                        className={cn(
                          "h-6 w-6 p-0 shrink-0 transition-none",
                          isUnreadConv && "bg-red-500 text-white hover:bg-red-600 border-transparent"
                        )}
                        onClick={handleToggleRead}
                        title={isUnreadConv ? 'Mark as read' : 'Mark as unread'}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <ConversationPreviewText preview={aggregated.latestMessage?.preview ?? null} />
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



'use client';

import { useEffect, useState, useMemo } from 'react';
import { useConversationsByContact } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatContactName } from '../utils/formatContactName';
import { formatConversationDate } from '../utils/formatDate';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  SearchableSelectInline,
} from '@altitutor/ui';
import { Plus, Mail, Filter, Search } from 'lucide-react';
import { cn } from '@/shared/utils';
import { messagesKeys } from '../api/queryKeys';
import { NewConversationDialog } from './NewConversationDialog';
import { useMarkUnread, useMarkRead } from '../api/mutations';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AggregatedConversation } from '../types';

type FilterOption = 'all' | 'unread' | 'unreplied' | 'to_follow_up';
const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'unreplied', label: 'Unreplied' },
  { value: 'to_follow_up', label: 'To follow up' },
];

interface Props {
  activeContactId?: string | null;
  onSelect: (contactId: string) => void;
}

export function ConversationList({ activeContactId, onSelect }: Props) {
  const { data } = useConversationsByContact();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'unreplied' | 'to_follow_up'>('all');
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const markUnreadMutation = useMarkUnread();
  const markReadMutation = useMarkRead();

  useEffect(() => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const channel = supabase
      .channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContact() });
        qc.invalidateQueries({ queryKey: messagesKeys.conversations() }); // Also invalidate old for backward compat
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContact() });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Check if aggregated conversation is unread (has unreadCount > 0)
  const isUnread = (aggregated: AggregatedConversation) => {
    return aggregated.unreadCount > 0;
  };
  
  // Check if aggregated conversation is unreplied (last message is inbound)
  const isUnreplied = (aggregated: AggregatedConversation) => {
    return aggregated.latestMessage?.direction === 'INBOUND';
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
    const items: AggregatedConversation[] = data || [];
    let filtered = items;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const normalizedSearch = normalizePhoneForSearch(searchTerm);
      filtered = filtered.filter((c) => {
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
        filtered = filtered.filter((c) => isUnread(c));
      } else if (activeFilter === 'unreplied') {
        filtered = filtered.filter((c) => isUnreplied(c));
      } else if (activeFilter === 'to_follow_up') {
        filtered = filtered.filter((c) => isToFollowUp(c));
      }
    }
    
    return filtered;
  }, [data, searchTerm, activeFilter]);

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

  const selectedFilterOption =
    FILTER_OPTIONS.find((o) => o.value === activeFilter) ?? FILTER_OPTIONS[0];

  const handleNewConversation = async (conversationId: string) => {
    // Get contactId from conversation
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', conversationId)
      .maybeSingle();
    
    if (conv?.contact_id) {
      onSelect(conv.contact_id);
    }
    setIsNewConversationDialogOpen(false);
    // Invalidate conversations to refresh the list
    qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContact() });
    qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
  };

  return (
    <div className="h-full border-r dark:border-brand-dark-border flex flex-col">
      <div className="p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Search bar - styled like searchable-select-inline */}
          <div className="flex flex-1 min-w-0 items-center rounded-md border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-9 w-full rounded-md border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search conversations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-2 flex-shrink-0 gap-1"
              >
                <Filter className="h-4 w-4" />
                <span className="text-xs">{activeFilterLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] p-0">
              <SearchableSelectInline<{ value: FilterOption; label: string }>
                items={FILTER_OPTIONS}
                value={selectedFilterOption}
                onValueChange={(v) => v && setActiveFilter(v.value)}
                getItemId={(item) => item.value}
                getItemLabel={(item) => item.label}
                searchPlaceholder="Search filters..."
                emptyMessage="No filters found"
              />
            </DropdownMenuContent>
          </DropdownMenu>
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
            const title = formatContactName({ contacts: aggregated.contact });
            const phoneNumber = aggregated.contact?.phone_e164;
            const isActive = aggregated.contactId === activeContactId;
            const isUnreadConv = isUnread(aggregated);
            const lastMessageTime = aggregated.latestMessageAt ? new Date(aggregated.latestMessageAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

            const handleToggleRead = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (isUnreadConv) {
                const lastMessageId = aggregated.latestMessage?.id;
                if (lastMessageId) {
                  markReadMutation.mutate({ contactId: aggregated.contactId, lastMessageId });
                }
              } else {
                aggregated.conversations.forEach((conv) => {
                  markUnreadMutation.mutate(conv.id);
                });
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
                  onClick={() => onSelect(aggregated.contactId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(aggregated.contactId);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{title}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {phoneNumber && (
                        <div className="text-xs text-muted-foreground shrink-0">{phoneNumber}</div>
                      )}
                      <Button
                        size="sm"
                        variant={isUnreadConv ? 'default' : 'outline'}
                        className={cn(
                          "h-6 w-6 p-0 shrink-0",
                          isUnreadConv && "bg-red-500 text-white hover:bg-red-600 border-transparent"
                        )}
                        onClick={handleToggleRead}
                        title={isUnreadConv ? 'Mark as read' : 'Mark as unread'}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {aggregated.latestMessageAt ? `${formatConversationDate(aggregated.latestMessageAt)} ${lastMessageTime}` : ''}
                  </div>
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
      />
    </div>
  );
}



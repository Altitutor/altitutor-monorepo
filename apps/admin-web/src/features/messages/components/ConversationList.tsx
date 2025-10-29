'use client';

import { useEffect, useState, useMemo } from 'react';
import { useConversations } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatContactName } from '../utils/formatContactName';
import { formatConversationDate } from '../utils/formatDate';
import { Badge } from '@altitutor/ui';

interface Props {
  activeConversationId?: string | null;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({ activeConversationId, onSelect }: Props) {
  const { data } = useConversations();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'unreplied'>('all');

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = data || [];
  
  // Check if conversation is unread (no conversation_reads entries exist)
  const isUnread = (conversation: any) => {
    return !conversation.conversation_reads || conversation.conversation_reads.length === 0;
  };
  
  // Check if conversation is unreplied (last message is inbound)
  const isUnreplied = (conversation: any) => {
    // Check if the last message (stored in messages field from query) is inbound
    return conversation.messages?.direction === 'INBOUND';
  };

  // Filter conversations by contact name/phone or filter pills
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((c: any) => {
        const contactName = formatContactName(c);
        const phoneNumber = c.contacts?.phone_e164 || '';
        return contactName.toLowerCase().includes(search) || phoneNumber.toLowerCase().includes(search);
      });
    } else {
      // Only apply filter pills when not searching
      if (activeFilter === 'unread') {
        filtered = filtered.filter((c: any) => isUnread(c));
      } else if (activeFilter === 'unreplied') {
        filtered = filtered.filter((c: any) => isUnreplied(c));
      }
    }
    
    return filtered;
  }, [items, searchTerm, activeFilter]);

  return (
    <div className="h-full border-r dark:border-brand-dark-border flex flex-col">
      <div className="p-3 flex-shrink-0">
        <input 
          className="w-full px-3 py-2 text-sm border rounded-md" 
          placeholder="Search conversations" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        {/* Filter pills - hidden when searching */}
        {!searchTerm.trim() && (
          <div className="flex gap-2 mt-2">
            <Badge 
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveFilter('all')}
            >
              All
            </Badge>
            <Badge 
              variant={activeFilter === 'unread' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveFilter('unread')}
            >
              Unread
            </Badge>
            <Badge 
              variant={activeFilter === 'unreplied' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveFilter('unreplied')}
            >
              Unreplied
            </Badge>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto divide-y dark:divide-brand-dark-border">
        {filteredItems.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {searchTerm ? 'No conversations found.' : 'No conversations yet.'}
          </div>
        ) : (
          filteredItems.map((c: any) => {
            const title = formatContactName(c);
            const phoneNumber = c.contacts?.phone_e164;
            const isActive = c.id === activeConversationId;
            const showUnreadDot = isUnread(c);
            const lastMessageTime = c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
            return (
              <button
                key={c.id}
                className={`w-full text-left p-3 hover:bg-muted ${isActive ? 'bg-muted' : ''}`}
                onClick={() => onSelect(c.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {showUnreadDot && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <div className="text-sm font-medium truncate">{title}</div>
                  </div>
                  {phoneNumber && (
                    <div className="text-xs text-muted-foreground ml-2 shrink-0">{phoneNumber}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.last_message_at ? `${formatConversationDate(c.last_message_at)} ${lastMessageTime}` : ''}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}



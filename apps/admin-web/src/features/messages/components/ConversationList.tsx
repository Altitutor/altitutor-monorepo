'use client';

import { useEffect, useState, useMemo } from 'react';
import { useConversationsByContact } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatContactName } from '../utils/formatContactName';
import { formatConversationDate } from '../utils/formatDate';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Plus, Mail } from 'lucide-react';
import { messagesKeys } from '../api/queryKeys';
import { NewConversationDialog } from './NewConversationDialog';
import { useMarkUnread } from '../api/mutations';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  activeContactId?: string | null;
  onSelect: (contactId: string) => void;
}

export function ConversationList({ activeContactId, onSelect }: Props) {
  const { data } = useConversationsByContact();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'unreplied'>('all');
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const [hoveredContactId, setHoveredContactId] = useState<string | null>(null);
  const markUnreadMutation = useMarkUnread();

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

  const items = data || [];
  
  // Check if aggregated conversation is unread (has unreadCount > 0)
  const isUnread = (aggregated: any) => {
    return aggregated.unreadCount > 0;
  };
  
  // Check if aggregated conversation is unreplied (last message is inbound)
  const isUnreplied = (aggregated: any) => {
    return aggregated.latestMessage?.direction === 'INBOUND';
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
          <input 
            className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-md" 
            placeholder="Search conversations" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button
            onClick={() => setIsNewConversationDialogOpen(true)}
            size="sm"
            className="h-[36px] w-[36px] p-0 flex-shrink-0"
            title="New Conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
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
          filteredItems.map((aggregated: any) => {
            const title = formatContactName({ contacts: aggregated.contact });
            const phoneNumber = aggregated.contact?.phone_e164;
            const isActive = aggregated.contactId === activeContactId;
            const showUnreadDot = isUnread(aggregated);
            const isRead = !showUnreadDot;
            const isHovered = hoveredContactId === aggregated.contactId;
            const lastMessageTime = aggregated.latestMessageAt ? new Date(aggregated.latestMessageAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
            
            // Mark all conversations for this contact as unread
            const handleMarkUnread = (e: React.MouseEvent) => {
              e.stopPropagation();
              // Mark all conversations for this contact as unread
              aggregated.conversations.forEach((conv: any) => {
                markUnreadMutation.mutate(conv.id);
              });
            };
            
            return (
              <div
                key={aggregated.contactId}
                className={`relative w-full ${isActive ? 'md:bg-muted' : ''}`}
                onMouseEnter={() => setHoveredContactId(aggregated.contactId)}
                onMouseLeave={() => setHoveredContactId(null)}
              >
                <button
                  className={`w-full text-left p-3 hover:bg-muted ${isActive ? 'md:bg-muted' : ''}`}
                  onClick={() => onSelect(aggregated.contactId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {showUnreadDot && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <div className="text-sm font-medium truncate">{title}</div>
                      {aggregated.conversations.length > 1 && (
                        <Badge variant="outline" className="text-[9px] px-1">
                          {aggregated.conversations.length} senders
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {phoneNumber && (
                        <div className="text-xs text-muted-foreground shrink-0">{phoneNumber}</div>
                      )}
                      {isHovered && isRead && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={handleMarkUnread}
                          title="Mark as unread"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {aggregated.latestMessageAt ? `${formatConversationDate(aggregated.latestMessageAt)} ${lastMessageTime}` : ''}
                  </div>
                </button>
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



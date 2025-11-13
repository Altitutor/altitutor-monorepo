'use client';

import { useMemo } from 'react';
import { useConversations } from '../api/queries';
import { formatContactName } from '../utils/formatContactName';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils';

interface Props {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  unreadCounts: Map<string, number>;
}


// Get initials from conversation
function getInitials(conversation: any): string {
  const contact = conversation?.contacts;
  if (!contact) return '?';

  switch (contact.contact_type) {
    case 'STUDENT': {
      const student = contact.students;
      if (student) {
        return `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase();
      }
      return contact.phone_e164?.[contact.phone_e164.length - 2] || '?';
    }
    case 'PARENT': {
      const parent = contact.parents;
      if (parent) {
        return `${parent.first_name?.[0] || ''}${parent.last_name?.[0] || ''}`.toUpperCase();
      }
      return contact.phone_e164?.[contact.phone_e164.length - 2] || '?';
    }
    case 'STAFF': {
      const staff = contact.staff;
      if (staff) {
        return `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase();
      }
      return contact.phone_e164?.[contact.phone_e164.length - 2] || '?';
    }
    default:
      // For LEAD or unknown types, use last two digits of phone
      return contact.phone_e164?.slice(-2) || '?';
  }
}

export function ConversationAvatarList({ activeConversationId, onSelect, unreadCounts }: Props) {
  const { data: conversations } = useConversations();
  
  // Check if conversation is unread (no conversation_reads entries exist)
  const isUnread = (conversation: any) => {
    return !conversation.conversation_reads || conversation.conversation_reads.length === 0;
  };
  
  // Sort conversations: unread first, then by last_message_at
  const sortedConversations = useMemo(() => {
    if (!conversations) return [];
    
    return [...conversations].sort((a, b) => {
      const aUnread = isUnread(a);
      const bUnread = isUnread(b);
      
      // Unread conversations first
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      
      // Then by last_message_at (most recent first)
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations]);
  
  return (
    <div className="flex flex-col h-full border-r dark:border-brand-dark-border bg-background dark:bg-brand-dark-card">
      <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2">
        {sortedConversations.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No conversations
          </div>
        ) : (
          sortedConversations.map((conversation: any) => {
            const conversationId = conversation.id;
            const isActive = conversationId === activeConversationId;
            const hasUnread = isUnread(conversation);
            const storeUnreadCount = unreadCounts.get(conversationId) || 0;
            // If conversation is unread (no conversation_reads), show indicator
            // Also show store unread count if it exists
            const showUnreadIndicator = hasUnread || storeUnreadCount > 0;
            const totalUnreadCount = hasUnread ? Math.max(1, storeUnreadCount) : storeUnreadCount;
            const fullName = formatContactName(conversation);
            const initials = getInitials(conversation);
            
            return (
              <TooltipProvider key={conversationId} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelect(conversationId)}
                      className={cn(
                        'relative w-12 h-12 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-sm font-medium transition-all hover:scale-110',
                        isActive && 'ring-2 ring-offset-2 ring-offset-background ring-accent'
                      )}
                      aria-label={fullName}
                    >
                      {initials}
                      {showUnreadIndicator && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                          {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{fullName}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })
        )}
      </div>
    </div>
  );
}


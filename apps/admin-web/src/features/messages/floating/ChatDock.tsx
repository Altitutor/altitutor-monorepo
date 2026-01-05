'use client';

import { useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore } from '../state/chatStore';
import { MessageThread } from '../components/MessageThread';
import { Composer } from '../components/Composer';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import { formatContactName } from '../utils/formatContactName';
import { useQuery } from '@tanstack/react-query';
import { useConversations } from '../api/queries';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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

function HorizontalConversationList({
  activeConversationId,
  onSelect,
  unreadCounts,
}: {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  unreadCounts: Map<string, number>;
}) {
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
    <div className="fixed bottom-4 left-4 right-[calc(1rem+64px+1rem)] sm:left-[calc(100vw-1rem-440px)] sm:right-[calc(1rem+64px+1rem)] z-40 h-16 w-auto sm:w-[360px] flex items-center">
      <div className="bg-background dark:bg-brand-dark-card border rounded-lg shadow-lg px-2 h-full w-full flex items-center">
        <div className="flex-1 overflow-x-auto overscroll-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-2 py-1">
          {sortedConversations.length === 0 ? (
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              No conversations
            </div>
          ) : (
            sortedConversations.map((conversation: any) => {
              const conversationId = conversation.id;
              const isActive = conversationId === activeConversationId;
              const hasUnread = isUnread(conversation);
              const storeUnreadCount = unreadCounts.get(conversationId) || 0;
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
                          'relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium transition-all hover:scale-110',
                          isActive && 'ring-2 ring-offset-1 ring-offset-background ring-accent'
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
                    <TooltipContent side="top">
                      <p>{fullName}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatDock() {
  const pathname = usePathname();
  const activeConversationId = useChatStore(s => s.activeConversationId);
  const minimized = useChatStore(s => s.minimized);
  const conversations = useChatStore(s => s.conversations);
  const setActiveConversation = useChatStore(s => s.setActiveConversation);
  const toggleMinimize = useChatStore(s => s.toggleMinimize);
  const openWindow = useChatStore(s => s.openWindow);
  const incrementUnread = useChatStore(s => s.incrementUnread);
  const hasWindow = useChatStore(s => s.hasWindow);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMessagesPage = pathname?.startsWith('/messages');

  // Extract function references using useRef to prevent re-subscriptions
  const hasWindowRef = useRef(hasWindow);
  const openWindowRef = useRef(openWindow);
  const incrementUnreadRef = useRef(incrementUnread);

  // Update refs on every render to always have latest functions
  useEffect(() => {
    hasWindowRef.current = hasWindow;
    openWindowRef.current = openWindow;
    incrementUnreadRef.current = incrementUnread;
  });

  // Get contactId from conversationId
  const { data: activeContactId } = useQuery({
    queryKey: ['contact-from-conversation', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', activeConversationId)
        .maybeSingle();
      if (error) throw error;
      return data?.contact_id || null;
    },
    enabled: !!activeConversationId,
  });

  // Fetch active contact details for header
  const { data: activeContact } = useQuery({
    queryKey: ['contact-header', activeContactId],
    queryFn: async () => {
      if (!activeContactId) return null;
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          phone_e164,
          contact_type,
          students (id, first_name, last_name),
          parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
          staff (id, first_name, last_name)
        `)
        .eq('id', activeContactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeContactId,
  });

  useEffect(() => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const channel = supabase
      .channel('messages-inbound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
        const row: any = (payload as any).new;
        if (row?.direction === 'INBOUND') {
          // Mark conversation as unread for all staff by deleting conversation_reads
          try {
            await supabase
              .from('conversation_reads')
              .delete()
              .eq('conversation_id', row.conversation_id);
            
            // Invalidate conversations query to update unread indicators
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          } catch (error) {
            console.error('[ChatDock] Failed to mark conversation as unread', error);
          }
          
          if (!hasWindowRef.current(row.conversation_id)) {
            openWindowRef.current({ conversationId: row.conversation_id, title: 'New message' });
          } else {
            incrementUnreadRef.current(row.conversation_id);
          }
          toast({ title: 'New message', description: row.body });
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('[ChatDock] Subscription error');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, queryClient]);

  // Convert conversations Map to unreadCounts Map (extract unreadCount from each value)
  // All hooks must be called unconditionally before any early returns
  const unreadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    conversations.forEach((value, key) => {
      counts.set(key, value.unreadCount);
    });
    return counts;
  }, [conversations]);

  // Compute display title (non-hook computation, can be after hooks but before early return)
  const displayTitle = useMemo(() => {
    return activeContact ? formatContactName({ contacts: activeContact }) : 'Messages';
  }, [activeContact]);

  // Early return after all hooks
  if (isMessagesPage) return null;

  // Chat bubble button - always visible, toggles open/close
  // Positioned to leave space for the conversation list below the dock
  const chatButton = (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className="w-16 h-16 rounded-full bg-accent text-accent-foreground dark:text-gray-900 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
        onClick={toggleMinimize}
        title={minimized ? "Open chat" : "Close chat"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
    </div>
  );

  // If minimized, show just the chat bubble button
  if (minimized) {
    return chatButton;
  }

  // Full chat dock window - positioned above the chat bubble button
  return (
    <>
      {chatButton}
      <div className="fixed top-4 bottom-24 right-4 left-4 sm:top-auto sm:bottom-24 sm:left-auto z-50 w-auto sm:w-[440px] max-w-[calc(100vw-2rem)] h-auto sm:h-[500px] sm:max-h-[calc(100vh-2rem)] shadow-lg rounded-md border bg-background dark:bg-brand-dark-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-brand-dark-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{displayTitle}</span>
          </div>
        </div>
      
      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat thread - full width now */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeContactId ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <MessageThread contactId={activeContactId} />
              </div>
              <div className="flex-shrink-0">
                <Composer contactId={activeContactId} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>
      </div>
      {/* Horizontally scrollable conversation list below chat dock */}
      <HorizontalConversationList
        activeConversationId={activeConversationId}
        onSelect={setActiveConversation}
        unreadCounts={unreadCounts}
      />
    </>
  );
}



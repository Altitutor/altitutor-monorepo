'use client';

import { useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore } from '../state/chatStore';
import { ConversationAvatarList } from './ConversationAvatarList';
import { MessageThread } from '../components/MessageThread';
import { Composer } from '../components/Composer';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Minus } from 'lucide-react';
import { formatContactName } from '../utils/formatContactName';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  // Fetch active conversation details for header
  const { data: activeConversation } = useQuery({
    queryKey: ['conversation-header', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contacts (
            id,
            phone_e164,
            contact_type,
            students (id, first_name, last_name),
            parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
            staff (id, first_name, last_name)
          )
        `)
        .eq('id', activeConversationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeConversationId,
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
    return activeConversation ? formatContactName(activeConversation) : 'Messages';
  }, [activeConversation]);

  // Early return after all hooks
  if (isMessagesPage) return null;

  // If minimized, show just a small minimized bar
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div 
          className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
          onClick={toggleMinimize}
          title="Open chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      </div>
    );
  }

  // Full chat dock window
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[440px] h-[500px] shadow-lg rounded-md border bg-background dark:bg-brand-dark-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-brand-dark-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{displayTitle}</span>
        </div>
        <button
          aria-label="Minimize"
          className="hover:opacity-80"
          onClick={toggleMinimize}
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      
      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar with avatars */}
        <div className="w-20 flex-shrink-0">
          <ConversationAvatarList
            activeConversationId={activeConversationId}
            onSelect={setActiveConversation}
            unreadCounts={unreadCounts}
          />
        </div>
        
        {/* Right side: chat thread */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeConversationId ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <MessageThread conversationId={activeConversationId} />
              </div>
              <div className="flex-shrink-0">
                <Composer conversationId={activeConversationId} />
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
  );
}



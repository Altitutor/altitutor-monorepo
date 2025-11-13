'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore } from '../state/chatStore';
import { ChatWindow } from './ChatWindow';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export function ChatDock() {
  const pathname = usePathname();
  const windows = useChatStore(s => s.windows);
  const openWindow = useChatStore(s => s.openWindow);
  const incrementUnread = useChatStore(s => s.incrementUnread);
  const hasWindow = useChatStore(s => s.hasWindow);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMessagesPage = pathname?.startsWith('/communications');

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
    // Only depend on stable references
  }, [toast, queryClient]);

  if (isMessagesPage) return null;

  // Always render the component even with no windows, so the subscription stays active
  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-3 flex-wrap justify-end">
      {windows.map(w => (
        <ChatWindow key={w.conversationId} descriptor={w} />
      ))}
    </div>
  );
}



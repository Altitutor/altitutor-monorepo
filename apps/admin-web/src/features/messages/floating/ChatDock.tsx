'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore } from '../state/chatStore';
import { ChatWindow } from './ChatWindow';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';

export function ChatDock() {
  const pathname = usePathname();
  const windows = useChatStore(s => s.windows);
  const openWindow = useChatStore(s => s.openWindow);
  const incrementUnread = useChatStore(s => s.incrementUnread);
  const hasWindow = useChatStore(s => s.hasWindow);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMessagesPage = pathname?.startsWith('/admin/dashboard/communications');

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('messages-inbound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
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
          
          if (!hasWindow(row.conversation_id)) {
            openWindow({ conversationId: row.conversation_id, title: 'New message' });
          } else {
            incrementUnread(row.conversation_id);
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
  }, [hasWindow, openWindow, incrementUnread, toast, queryClient]);

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



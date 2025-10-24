'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore } from '../state/chatStore';
import { ChatWindow } from './ChatWindow';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useToast } from '@altitutor/ui';

export function ChatDock() {
  const pathname = usePathname();
  const windows = useChatStore(s => s.windows);
  const openWindow = useChatStore(s => s.openWindow);
  const incrementUnread = useChatStore(s => s.incrementUnread);
  const hasWindow = useChatStore(s => s.hasWindow);
  const { toast } = useToast();

  const isMessagesPage = pathname?.startsWith('/admin/dashboard/communications');

  useEffect(() => {
    const supabase = getSupabaseClient();
    console.debug('[ChatDock] Setting up inbound messages subscription');
    const channel = supabase
      .channel('messages-inbound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row: any = (payload as any).new;
        console.debug('[ChatDock] Message INSERT', { direction: row?.direction, conversationId: row?.conversation_id });
        if (row?.direction === 'INBOUND') {
          if (!hasWindow(row.conversation_id)) {
            console.debug('[ChatDock] Opening new window for conversation', row.conversation_id);
            openWindow({ conversationId: row.conversation_id, title: 'New message' });
          } else {
            console.debug('[ChatDock] Incrementing unread for existing window', row.conversation_id);
            incrementUnread(row.conversation_id);
          }
          toast({ title: 'New message', description: row.body });
        }
      })
      .subscribe((status: string) => {
        console.debug('[ChatDock] Subscription status', { status });
      });
    return () => {
      console.debug('[ChatDock] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [hasWindow, openWindow, incrementUnread, toast]);

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



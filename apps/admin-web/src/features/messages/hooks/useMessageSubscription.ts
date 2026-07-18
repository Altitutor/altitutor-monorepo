'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useToast } from '@altitutor/ui';
import { messagesKeys } from '../api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useChatStore } from '../state/chatStore';
import { formatContactName } from '../utils/formatContactName';

/**
 * Hook to subscribe to new inbound messages
 * Handles marking conversations as unread and showing notifications
 */
export function useMessageSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasWindow = useChatStore(s => s.hasWindow);
  const incrementUnread = useChatStore(s => s.incrementUnread);

  // Extract function references using useRef to prevent re-subscriptions
  const hasWindowRef = useRef(hasWindow);
  const incrementUnreadRef = useRef(incrementUnread);

  // Update refs on every render to always have latest functions
  useEffect(() => {
    hasWindowRef.current = hasWindow;
    incrementUnreadRef.current = incrementUnread;
  });

  useEffect(() => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const channel = supabase
      .channel('messages-inbound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const row = payload.new as Database['public']['Tables']['messages']['Row'];
        if (row?.direction !== 'INBOUND') return;

        // Always refresh inbox/thread caches; historical backfill should not toast/unread.
        queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
        queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
        queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
        queryClient.invalidateQueries({ queryKey: messagesKeys.messages(row.conversation_id) });

        if (row.is_historical_import) return;

        // Mark conversation as unread for all staff by deleting conversation_reads
        try {
          await supabase
            .from('conversation_reads')
            .delete()
            .eq('conversation_id', row.conversation_id);
          
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
          queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
        } catch (error: unknown) {
          console.error('[useMessageSubscription] Failed to mark conversation as unread', error);
        }
        
        // Fetch conversation with contact info to get sender name
        let senderName = 'Unknown';
        try {
          const { data: conversation } = await supabase
            .from('conversations')
            .select(`
              id,
              contacts (
                id, phone_e164, contact_type,
                students (id, first_name, last_name),
                parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
                staff (id, first_name, last_name)
              )
            `)
            .eq('id', row.conversation_id)
            .maybeSingle();
          
          if (conversation?.contacts) {
            senderName = formatContactName({ contacts: conversation.contacts });
          }
        } catch (error: unknown) {
          console.error('[useMessageSubscription] Failed to fetch conversation for sender name', error);
        }
        
        if (hasWindowRef.current(row.conversation_id)) {
          incrementUnreadRef.current(row.conversation_id);
        }
        toast({ title: `${senderName}: ${row.body}`, description: '' });
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('[useMessageSubscription] Subscription error');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, queryClient]);
}

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
 * Hook to subscribe to new messages.
 * Refreshes inbox/thread caches for inbound and device-sent outbound traffic,
 * and shows notifications for live inbound messages.
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
        if (!row?.conversation_id) return;

        // Device-sent outbound (iPhone/Mac → BlueBubbles) must refresh the open
        // thread/list immediately — do not early-return on OUTBOUND.
        queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
        queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
        queryClient.invalidateQueries({ queryKey: messagesKeys.messages(row.conversation_id) });
        queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });

        let senderName = 'Unknown';
        let contactId: string | null = null;
        let isGroupChat = false;
        let groupChatName: string | null = null;
        try {
          const { data: conversation } = await supabase
            .from('conversations')
            .select(`
              id,
              contact_id,
              is_group_chat,
              group_chat_name,
              contacts (
                id, phone_e164, contact_type,
                students (id, first_name, last_name),
                parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
                staff (id, first_name, last_name)
              )
            `)
            .eq('id', row.conversation_id)
            .maybeSingle();
          
          contactId = conversation?.contact_id ?? null;
          isGroupChat = conversation?.is_group_chat === true;
          groupChatName = conversation?.group_chat_name ?? null;
          if (conversation?.contacts) {
            senderName = formatContactName({ contacts: conversation.contacts });
          } else if (isGroupChat && groupChatName) {
            senderName = groupChatName;
          }
        } catch (error: unknown) {
          console.error('[useMessageSubscription] Failed to fetch conversation for sender name', error);
        }

        if (contactId) {
          queryClient.invalidateQueries({
            queryKey: messagesKeys.messagesForContactBase(contactId),
          });
        }

        // Toasts / unread only for live inbound
        if (row.direction !== 'INBOUND' || row.is_historical_import) return;

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
        
        if (hasWindowRef.current(row.conversation_id)) {
          incrementUnreadRef.current(row.conversation_id);
        }

        const toastTitle = row.body?.trim()
          ? `${senderName}: ${row.body}`
          : `${senderName}: New message`;

        toast({
          title: toastTitle,
          action: {
            label: 'Reply',
            onClick: () => {
              if (isGroupChat || !contactId) {
                window.location.assign(`/messages?group=${row.conversation_id}`);
                return;
              }
              useChatStore.getState().openWindow({
                conversationId: row.conversation_id,
                title: senderName,
              });
            },
          },
        });
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

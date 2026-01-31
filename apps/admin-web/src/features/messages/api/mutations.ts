'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { messagesKeys } from './queryKeys';
import { ensureConversationForContact } from './queries';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useSendMessage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: async (args: { 
      contactId: string; 
      body: string; 
      selectedSenderId: string;
    }) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get staff ID
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      // Get contact phone number
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone_e164')
        .eq('id', args.contactId)
        .maybeSingle();

      const toNumber = contact?.phone_e164;
      if (!toNumber) {
        throw new Error('Contact phone number not found');
      }

      // Get selected sender details
      const { data: sender } = await supabase
        .from('owned_numbers')
        .select('id, phone_e164, alphanumeric_sender_id, sender_type, label')
        .eq('id', args.selectedSenderId)
        .maybeSingle();

      if (!sender) {
        throw new Error('Selected sender not found');
      }

      // Ensure conversation exists with selected sender
      const conversationId = await ensureConversationForContact(args.contactId, args.selectedSenderId);

      // Determine from value based on sender type
      const fromValue = sender.sender_type === 'ALPHANUMERIC'
        ? sender.alphanumeric_sender_id
        : sender.phone_e164;
      
      if (!fromValue) {
        throw new Error('Sender has no valid from value');
      }

      // Create message row (QUEUED)
      // ensureConversationForContact returns Promise<string>, so conversationId is always a string
      const { data: created, error: insertErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          direction: 'OUTBOUND',
          body: args.body,
          status: 'QUEUED',
          created_by_staff_id: staffRow?.id || null,
          from_number_e164: sender.sender_type === 'PHONE' ? sender.phone_e164 : null, // NULL for alphanumeric
          to_number_e164: toNumber,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Fire-and-forget the send to avoid blocking UI; failures are handled in the function
      // which marks the message as FAILED when applicable.
      supabase.functions
        .invoke('send-message', { body: { messageId: created.id } })
        .catch((e: any) => console.error('[send-message invoke] error', e?.message || e));

      // Return immediately so UI can refresh and show the queued message
      return { messageId: created.id, conversationId };
    },
    onSuccess: (result, vars) => {
      // Invalidate messages for this contact (aggregated view)
      qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(vars.contactId) });
      // Also invalidate the specific conversation's messages (for backward compatibility)
      qc.invalidateQueries({ queryKey: messagesKeys.messages(result.conversationId) });
      // Invalidate conversations list (both old and new aggregated)
      qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
      qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContact() });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: async (args: { contactId: string; lastMessageId: string }) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      // Use auth store user ID instead of calling auth.getUser() to avoid excessive auth requests
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();
      if (!staff?.id) return;
      
      // Get all conversations for this contact and mark them all as read
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', args.contactId)
        .in('status', ['OPEN', 'SNOOZED']);
      
      if (conversations && conversations.length > 0) {
        // Mark all conversations as read
        await Promise.all(
          conversations.map((conv) =>
            supabase
              .from('conversation_reads')
              .upsert({
                conversation_id: conv.id,
                staff_id: staff.id,
                last_read_message_id: args.lastMessageId,
                last_read_at: new Date().toISOString(),
              }, { onConflict: 'conversation_id,staff_id' })
          )
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
      qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContact() });
    },
  });
}

export function useMarkUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      await supabase
        .from('conversation_reads')
        .delete()
        .eq('conversation_id', conversationId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
    },
  });
}

/**
 * Delete a message
 * Only ADMINSTAFF can delete messages (enforced by RLS)
 */
export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all message-related queries
      qc.invalidateQueries({ queryKey: messagesKeys.all });
      // Also invalidate reconciliation queries since failed messages view will change
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
    },
  });
}



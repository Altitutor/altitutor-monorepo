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
      contactId?: string | null;
      conversationId?: string | null;
      groupChatId?: string | null;
      body: string; 
      selectedSenderId: string;
      attachments?: Array<{
        storageUrl: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    }) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get staff ID
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      // Get contact phone number
      const { data: contact } = args.contactId
        ? await supabase
            .from('contacts')
            .select('phone_e164')
            .eq('id', args.contactId)
            .maybeSingle()
        : { data: null };

      const toNumber = args.groupChatId ?? contact?.phone_e164;
      if (!toNumber) {
        throw new Error('Message destination not found');
      }

      // Get selected sender details
      const { data: sender } = await supabase
        .from('owned_numbers')
        .select('id, phone_e164, alphanumeric_sender_id, sender_type, label, provider')
        .eq('id', args.selectedSenderId)
        .maybeSingle();

      if (!sender) {
        throw new Error('Selected sender not found');
      }

      if (args.groupChatId && sender.provider !== 'IMESSAGE') {
        throw new Error('Group chats require an iMessage sender');
      }

      const conversationId = args.conversationId
        ?? (args.contactId
          ? await ensureConversationForContact(args.contactId, args.selectedSenderId)
          : null);
      if (!conversationId) throw new Error('Conversation not found');

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

      // Create message_attachments records if attachments provided
      if (args.attachments && args.attachments.length > 0) {
        const attachmentInserts = args.attachments.map(att => ({
          message_id: created.id,
          storage_url: att.storageUrl,
          filename: att.filename,
          mime_type: att.mimeType,
          size_bytes: att.sizeBytes,
        }));

        const { error: attErr } = await supabase
          .from('message_attachments')
          .insert(attachmentInserts);

        if (attErr) {
          console.error('[useSendMessage] Failed to insert attachments', attErr);
          // Don't throw - message was created successfully, attachments are optional
        }
      }

      // Fire-and-forget the send to avoid blocking UI; failures are handled in the function
      // which marks the message as FAILED when applicable.
      supabase.functions
        .invoke('send-message', { body: { messageId: created.id } })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[send-message invoke] error', msg);
        });

      // Return immediately so UI can refresh and show the queued message
      return { messageId: created.id, conversationId };
    },
    onSuccess: (result, vars) => {
      // Invalidate messages for this contact (aggregated view)
      if (vars.contactId) {
        qc.invalidateQueries({ queryKey: messagesKeys.messagesForContactBase(vars.contactId) });
      }
      // Also invalidate the specific conversation's messages (for backward compatibility)
      qc.invalidateQueries({ queryKey: messagesKeys.messages(result.conversationId) });
      // Invalidate conversations list (both old and new aggregated)
      qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
      qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
      qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
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
      qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
      qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
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
      qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
      qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
    },
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: async (args: { conversationId: string; lastMessageId: string }) => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();
      if (!staff?.id) return;

      const { error } = await supabase
        .from('conversation_reads')
        .upsert({
          conversation_id: args.conversationId,
          staff_id: staff.id,
          last_read_message_id: args.lastMessageId,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,staff_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
      qc.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
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



'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { messagesKeys } from './queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useSendMessage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: async (args: { conversationId: string; body: string }) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      // Create message row (QUEUED)
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      // We must populate from/to numbers based on the conversation's owned number and contact
      const { data: conv } = await supabase
        .from('conversations')
        .select('owned_number:owned_numbers(phone_e164), contact:contacts(phone_e164)')
        .eq('id', args.conversationId)
        .maybeSingle();

      const fromNumber = conv?.owned_number?.phone_e164 as string | undefined;
      const toNumber = conv?.contact?.phone_e164 as string | undefined;
      if (!fromNumber || !toNumber) throw new Error('Conversation routing numbers not found');

      const { data: created, error: insertErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: args.conversationId,
          direction: 'OUTBOUND',
          body: args.body,
          status: 'QUEUED',
          created_by_staff_id: staffRow?.id || null,
          from_number_e164: fromNumber,
          to_number_e164: toNumber,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Fire-and-forget the send to avoid blocking UI; failures are handled in the function
      // which marks the message as FAILED when applicable.
      supabase.functions
        .invoke('send-sms', { body: { messageId: created.id } })
        .catch((e: any) => console.error('[send-sms invoke] error', e?.message || e));

      // Return immediately so UI can refresh and show the queued message
      return created.id as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: messagesKeys.messages(vars.conversationId) });
      qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: async (args: { conversationId: string; lastMessageId: string }) => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      // Use auth store user ID instead of calling auth.getUser() to avoid excessive auth requests
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();
      if (!staff?.id) return;
      await supabase
        .from('conversation_reads')
        .upsert({
          conversation_id: args.conversationId,
          staff_id: staff.id,
          last_read_message_id: args.lastMessageId,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,staff_id' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagesKeys.conversations() });
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



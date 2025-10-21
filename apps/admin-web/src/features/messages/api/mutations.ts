'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';

export function useSendMessage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: async (args: { conversationId: string; body: string }) => {
      const supabase = getSupabaseClient();
      // Create message row (QUEUED)
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const { data: created, error: insertErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: args.conversationId,
          direction: 'OUTBOUND',
          body: args.body,
          status: 'QUEUED',
          created_by_staff_id: staffRow?.id || null,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Call send-sms edge function
      await fetch('/functions/v1/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: created.id }),
      });

      return created.id as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { conversationId: string; lastMessageId: string }) => {
      const supabase = getSupabaseClient();
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
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
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}



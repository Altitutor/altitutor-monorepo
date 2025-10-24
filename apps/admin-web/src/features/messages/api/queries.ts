'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

const PAGE_SIZE = 30;

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      // Get current user's staff ID for read tracking
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      
      // Fetch conversations with last message and read status
      const { data, error } = await (supabase as any)
        .from('conversations')
        .select(`
          id, 
          status, 
          last_message_at, 
          last_message_id,
          assigned_staff_id, 
          contact_id, 
          owned_number_id, 
          contacts(id, display_name, phone_e164, contact_type, students(id, first_name, last_name), parents(id, first_name, last_name, parents_students(students(id, first_name, last_name))), staff(id, first_name, last_name)), 
          owned_numbers(id, phone_e164, label),
          messages!conversations_last_message_id_fkey(id, direction),
          conversation_reads(id, last_read_message_id, last_read_at)
        `)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

type Page = { items: any[]; nextCursor?: string };

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Page | undefined) => lastPage?.nextCursor,
    queryFn: async ({ pageParam }) => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('messages')
        .select('*, staff:created_by_staff_id(id, first_name, last_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }
      const { data, error } = await query;
      if (error) throw error;
      const nextCursor = data && data.length === PAGE_SIZE ? (data[data.length - 1] as any).created_at : undefined;
      const page: Page = { items: (data as any) || [], nextCursor };
      return page;
    },
  });
}

export async function ensureConversationForContact(contactId: string): Promise<string> {
  const supabase = getSupabaseClient();
  // Find default owned number
  const { data: owned, error: ownedErr } = await supabase
    .from('owned_numbers')
    .select('id')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();
  if (ownedErr) throw ownedErr;
  const ownedNumberId = owned?.id;

  if (!ownedNumberId) {
    // fallback to any owned number
    const { data: anyOwned } = await supabase.from('owned_numbers').select('id').limit(1).maybeSingle();
    if (!anyOwned?.id) throw new Error('No owned numbers configured');
    const { id } = anyOwned;
    return ensureConversation(contactId, id);
  }
  return ensureConversation(contactId, ownedNumberId);
}

async function ensureConversation(contactId: string, ownedNumberId: string): Promise<string> {
  const supabase = getSupabaseClient();
  // Try find active
  const { data: existing, error: findErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('owned_number_id', ownedNumberId)
    .in('status', ['OPEN', 'SNOOZED'])
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  // Create
  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({ contact_id: contactId, owned_number_id: ownedNumberId, status: 'OPEN' })
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id as string;
}



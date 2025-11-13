'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { messagesKeys } from './queryKeys';

const PAGE_SIZE = 30;

export function useConversations() {
  return useQuery({
    queryKey: messagesKeys.conversations(),
    queryFn: async () => {
      const supabase = getSupabaseClient() as any;
      
      // Fetch conversations with nested data
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, status, last_message_at, last_message_id,
          assigned_staff_id, contact_id, owned_number_id,
          contacts!inner(
            id, phone_e164, contact_type, student_id, parent_id, staff_id,
            students(id, first_name, last_name),
            parents(id, first_name, last_name),
            staff(id, first_name, last_name)
          ),
          owned_numbers(id, phone_e164, label),
          conversation_reads(id, last_read_message_id, last_read_at)
        `)
        .order('last_message_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Batch fetch last messages
      const messageIds = (data || [])
        .map((conv: any) => conv.last_message_id)
        .filter(Boolean);
      
      let messageMap = new Map();
      if (messageIds.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('id, direction')
          .in('id', messageIds);
        
        if (messages) {
          messageMap = new Map(messages.map((m: any) => [m.id, m]));
        }
      }
      
      // Attach last message to each conversation
      return (data || []).map((conv: any) => ({
        ...conv,
        messages: conv.last_message_id ? messageMap.get(conv.last_message_id) || null : null
      }));
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false, // Realtime handles updates
  });
}

// Removed unused Page type

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: messagesKeys.messages(conversationId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const supabase = getSupabaseClient() as any;
      
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
      
      const nextCursor = data && data.length === PAGE_SIZE 
        ? (data[data.length - 1] as any).created_at 
        : undefined;
      
      return { items: data || [], nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    staleTime: 1000 * 60, // 1 minute
    retry: 1, // Only retry once instead of 3 times
    refetchOnWindowFocus: false, // Realtime handles updates
  });
}

export function useConversationDetails(conversationId: string | null) {
  return useQuery({
    queryKey: messagesKeys.conversationInfo(conversationId || ''),
    queryFn: async () => {
      if (!conversationId) return null;
      
      const supabase = getSupabaseClient() as any;
      const { data, error } = await supabase
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
        .eq('id', conversationId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export async function ensureConversationForContact(contactId: string): Promise<string> {
  const supabase = (getSupabaseClient() as any);
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

// Helper to get contact ID from student/staff/parent ID
export async function getContactIdByRelatedId(relatedId: string, type: 'student' | 'staff' | 'parent'): Promise<string | null> {
  const supabase = (getSupabaseClient() as any);
  const field = type === 'student' ? 'student_id' : type === 'staff' ? 'staff_id' : 'parent_id';
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq(field, relatedId)
    .maybeSingle();
  if (error) {
    console.error('[getContactIdByRelatedId] Error:', error);
    throw error;
  }
  return data?.id || null;
}

// Helper to GET EXISTING conversation for student/staff/parent (does NOT create)
export async function getExistingConversationForRelated(relatedId: string, type: 'student' | 'staff' | 'parent'): Promise<string | null> {
  const contactId = await getContactIdByRelatedId(relatedId, type);
  if (!contactId) {
    return null;
  }
  
  const supabase = (getSupabaseClient() as any);
  
  // Get default owned number
  const { data: owned } = await supabase
    .from('owned_numbers')
    .select('id')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();
  
  const ownedNumberId = owned?.id;
  if (!ownedNumberId) {
    // fallback to any owned number
    const { data: anyOwned } = await supabase.from('owned_numbers').select('id').limit(1).maybeSingle();
    if (!anyOwned?.id) {
      return null;
    }
    const ownedId = anyOwned.id;
    
    // Try find existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('owned_number_id', ownedId)
      .in('status', ['OPEN', 'SNOOZED'])
      .limit(1)
      .maybeSingle();
    
    return existing?.id || null;
  }
  
  // Try find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('owned_number_id', ownedNumberId)
    .in('status', ['OPEN', 'SNOOZED'])
    .limit(1)
    .maybeSingle();
  
  return existing?.id || null;
}

// Helper to ensure conversation for student/staff/parent (CREATES if needed)
export async function ensureConversationForRelated(relatedId: string, type: 'student' | 'staff' | 'parent'): Promise<string | null> {
  const contactId = await getContactIdByRelatedId(relatedId, type);
  if (!contactId) {
    return null;
  }
  const conversationId = await ensureConversationForContact(contactId);
  return conversationId;
}

async function ensureConversation(contactId: string, ownedNumberId: string): Promise<string> {
  const supabase = (getSupabaseClient() as any);
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

  // Create - with error handling for duplicate constraint
  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({ contact_id: contactId, owned_number_id: ownedNumberId, status: 'OPEN' })
    .select('id')
    .maybeSingle();
  
  // If duplicate key error (conversation was created between our check and insert), retry the select
  if (createErr && createErr.code === '23505') {
    const { data: retry } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('owned_number_id', ownedNumberId)
      .in('status', ['OPEN', 'SNOOZED'])
      .limit(1)
      .maybeSingle();
    if (retry?.id) return retry.id;
  }
  
  if (createErr) throw createErr;
  return created?.id as string;
}



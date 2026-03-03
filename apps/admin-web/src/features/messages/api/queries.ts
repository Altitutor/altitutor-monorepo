'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { messagesKeys } from './queryKeys';
import type { Sender, AggregatedConversation } from '../types';
import type { Tables } from '@altitutor/shared';

// Re-export types for backward compatibility
export type { Sender, AggregatedConversation } from '../types';

const PAGE_SIZE = 30;

type ConversationRow = {
  id: string;
  status: string;
  last_message_at: string | null;
  last_message_id: string | null;
  assigned_staff_id: string | null;
  contact_id: string | null;
  owned_number_id: string;
  is_group_chat: boolean;
  group_chat_id: string | null;
  group_chat_name: string | null;
  needs_follow_up?: boolean;
  contacts: {
    id: string;
    phone_e164: string | null;
    contact_type: string;
    student_id: string | null;
    parent_id: string | null;
    staff_id: string | null;
    students: Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name'> | null;
    parents: Pick<Tables<'parents'>, 'id' | 'first_name' | 'last_name'> | null;
    staff: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name'> | null;
  };
  owned_numbers: Pick<Tables<'owned_numbers'>, 'id' | 'phone_e164' | 'label'> | null;
  conversation_reads: Array<Pick<Tables<'conversation_reads'>, 'id' | 'last_read_message_id' | 'last_read_at'>>;
};

type MessageRow = {
  id: string;
  direction: string;
};

export function useConversations() {
  return useQuery({
    queryKey: messagesKeys.conversations(),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      
      // Fetch conversations with nested data
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, status, last_message_at, last_message_id,
          assigned_staff_id, contact_id, owned_number_id,
          is_group_chat, group_chat_id, group_chat_name,
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
        .map((conv: ConversationRow) => conv.last_message_id)
        .filter((id): id is string => Boolean(id));
      
      let messageMap = new Map<string, MessageRow>();
      if (messageIds.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('id, direction')
          .in('id', messageIds);
        
        if (messages) {
          messageMap = new Map(messages.map((m: MessageRow) => [m.id, m]));
        }
      }
      
      // Attach last message to each conversation
      return (data || []).map((conv: ConversationRow) => ({
        ...conv,
        messages: conv.last_message_id ? messageMap.get(conv.last_message_id) || null : null
      }));
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false, // Realtime handles updates
  });
}

// Removed unused Page type

type MessageWithRelations = Tables<'messages'> & {
  staff: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name'> | null;
  message_attachments: Array<Pick<Tables<'message_attachments'>, 'id' | 'storage_url' | 'filename' | 'mime_type' | 'size_bytes'>>;
};

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: messagesKeys.messages(conversationId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const supabase = getSupabaseClient();
      
      let query = supabase
        .from('messages')
        .select('*, staff:created_by_staff_id(id, first_name, last_name), message_attachments(id, storage_url, filename, mime_type, size_bytes)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const messages = (data || []) as MessageWithRelations[];
      const nextCursor = messages.length === PAGE_SIZE 
        ? messages[messages.length - 1].created_at 
        : undefined;
      
      return { items: messages, nextCursor };
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
      
      const supabase = getSupabaseClient();
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

export async function ensureConversationForContact(contactId: string, ownedNumberId?: string): Promise<string> {
  const supabase = getSupabaseClient();
  
  // If ownedNumberId is provided, use it; otherwise find default
  if (ownedNumberId) {
    return ensureConversation(contactId, ownedNumberId);
  }
  
  // Find default owned number
  const { data: owned, error: ownedErr } = await supabase
    .from('owned_numbers')
    .select('id')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();
  if (ownedErr) throw ownedErr;
  const defaultOwnedNumberId = owned?.id;

  if (!defaultOwnedNumberId) {
    // fallback to any owned number
    const { data: anyOwned } = await supabase.from('owned_numbers').select('id').limit(1).maybeSingle();
    if (!anyOwned?.id) throw new Error('No owned numbers configured');
    const { id } = anyOwned;
    return ensureConversation(contactId, id);
  }
  return ensureConversation(contactId, defaultOwnedNumberId);
}

// Helper to get contact ID from student/staff/parent ID
export async function getContactIdByRelatedId(relatedId: string, type: 'student' | 'staff' | 'parent'): Promise<string | null> {
  const supabase = getSupabaseClient();
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
  
  const supabase = getSupabaseClient();
  
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

export function useAvailableSenders() {
  return useQuery({
    queryKey: ['owned_numbers', 'senders'],
    queryFn: async (): Promise<Sender[]> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('owned_numbers')
        .select('id, phone_e164, alphanumeric_sender_id, sender_type, label, is_default, provider')
        .order('is_default', { ascending: false })
        .order('label');
      
      if (error) throw error;
      return (data || []) as Sender[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Aggregates conversations by contact - shows one "conversation" per contact
 * combining all conversations from different senders
 */
type ConversationWithLastMessage = ConversationRow;

type MessageWithCreatedAt = MessageRow & {
  created_at: string;
};

export function useConversationsByContact() {
  return useQuery({
    queryKey: messagesKeys.conversationsByContact(),
    queryFn: async (): Promise<AggregatedConversation[]> => {
      const supabase = getSupabaseClient();
      
      // Fetch all conversations with nested data
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id, status, last_message_at, last_message_id,
          assigned_staff_id, contact_id, owned_number_id,
          is_group_chat, group_chat_id, group_chat_name,
          needs_follow_up,
          contacts!inner(
            id, phone_e164, contact_type, student_id, parent_id, staff_id,
            students(id, first_name, last_name),
            parents(id, first_name, last_name),
            staff(id, first_name, last_name)
          ),
          owned_numbers(id, phone_e164, alphanumeric_sender_id, sender_type, label, provider),
          conversation_reads(id, last_read_message_id, last_read_at)
        `)
        .in('status', ['OPEN', 'SNOOZED'])
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      
      // Batch fetch last messages
      const typedConversations = (conversations || []) as ConversationWithLastMessage[];
      const messageIds = typedConversations
        .map((conv) => conv.last_message_id)
        .filter((id): id is string => Boolean(id));
      
      let messageMap = new Map<string, MessageWithCreatedAt>();
      if (messageIds.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('id, direction, created_at')
          .in('id', messageIds);
        
        if (messages) {
          messageMap = new Map((messages as MessageWithCreatedAt[]).map((m) => [m.id, m]));
        }
      }
      
      // Group conversations by contact_id
      const byContact = new Map<string, AggregatedConversation>();
      
      for (const conv of typedConversations) {
        const contactId = conv.contact_id;
        
        // Skip conversations without contact_id
        if (!contactId) continue;
        
        if (!byContact.has(contactId)) {
          byContact.set(contactId, {
            contactId,
            contact: conv.contacts,
            conversations: [],
            latestMessageAt: null,
            latestMessage: null,
            unreadCount: 0,
          });
        }
        
        const aggregated = byContact.get(contactId)!;
        const lastMessage = conv.last_message_id ? messageMap.get(conv.last_message_id) : null;
        
        aggregated.conversations.push({
          id: conv.id,
          owned_number_id: conv.owned_number_id,
          owned_number: conv.owned_numbers,
          last_message_at: conv.last_message_at,
          last_message_id: conv.last_message_id,
          last_message: lastMessage ? { id: lastMessage.id, direction: lastMessage.direction } : null,
          status: conv.status,
          needs_follow_up: conv.needs_follow_up ?? false,
        });
        
        // Track latest message across all conversations
        if (conv.last_message_at && (!aggregated.latestMessageAt || conv.last_message_at > aggregated.latestMessageAt)) {
          aggregated.latestMessageAt = conv.last_message_at;
          aggregated.latestMessage = lastMessage ? { id: lastMessage.id, direction: lastMessage.direction } : null;
        }
        
        // Count unread (no conversation_reads entry means unread)
        if (!conv.conversation_reads || conv.conversation_reads.length === 0) {
          aggregated.unreadCount++;
        }
      }
      
      // Convert to array and sort by latest message time
      return Array.from(byContact.values()).sort((a, b) => {
        if (!a.latestMessageAt && !b.latestMessageAt) return 0;
        if (!a.latestMessageAt) return 1;
        if (!b.latestMessageAt) return -1;
        return b.latestMessageAt.localeCompare(a.latestMessageAt);
      });
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false, // Realtime handles updates
  });
}

/**
 * Fetches messages from all conversations for a given contact
 * Merges and sorts chronologically
 */
type ConversationForContact = {
  id: string;
  owned_number_id: string;
  owned_numbers: Pick<Tables<'owned_numbers'>, 'id' | 'phone_e164' | 'alphanumeric_sender_id' | 'sender_type' | 'label' | 'provider'> | null;
};

type SenderInfo = {
  owned_number_id: string;
  sender: Pick<Tables<'owned_numbers'>, 'id' | 'phone_e164' | 'alphanumeric_sender_id' | 'sender_type' | 'label' | 'provider'> | null;
};

export function useMessagesForContact(contactId: string | null) {
  return useInfiniteQuery({
    queryKey: messagesKeys.messagesForContact(contactId || ''),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!contactId) return { items: [], nextCursor: undefined };
      
      const supabase = getSupabaseClient();
      
      // Get all conversation IDs for this contact
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, owned_number_id, owned_numbers(id, phone_e164, alphanumeric_sender_id, sender_type, label, provider)')
        .eq('contact_id', contactId)
        .in('status', ['OPEN', 'SNOOZED']);
      
      if (convError) throw convError;
      
      const typedConversations = (conversations || []) as ConversationForContact[];
      const conversationIds = typedConversations.map((c) => c.id);
      if (conversationIds.length === 0) {
        return { items: [], nextCursor: undefined };
      }
      
      // Create a map of conversation_id -> sender info
      const senderMap = new Map<string, SenderInfo>(
        typedConversations.map((c) => [
          c.id,
          {
            owned_number_id: c.owned_number_id,
            sender: c.owned_numbers,
          },
        ])
      );
      
      // Fetch messages from all conversations
      let query = supabase
        .from('messages')
        .select('*, staff:created_by_staff_id(id, first_name, last_name), message_attachments(id, storage_url, filename, mime_type, size_bytes)')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }
      
      const { data: messages, error } = await query;
      if (error) throw error;
      
      // Attach sender info to each message
      const typedMessages = (messages || []) as MessageWithRelations[];
      const enrichedMessages = typedMessages.map((msg) => {
        const senderInfo = senderMap.get(msg.conversation_id);
        return {
          ...msg,
          sender: senderInfo?.sender || null,
          conversation_owned_number_id: senderInfo?.owned_number_id || null,
        };
      });
      
      const nextCursor = enrichedMessages.length === PAGE_SIZE 
        ? enrichedMessages[enrichedMessages.length - 1].created_at 
        : undefined;
      
      return { items: enrichedMessages, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!contactId,
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
    refetchOnWindowFocus: false, // Realtime handles updates
  });
}

/**
 * Get contact ID from conversation ID
 */
export async function getContactIdFromConversation(conversationId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('contact_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return data?.contact_id || null;
}

/**
 * Get contact details for header display
 */
export async function getContactHeader(contactId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id,
      phone_e164,
      contact_type,
      students (id, first_name, last_name),
      parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
      staff (id, first_name, last_name)
    `)
    .eq('id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Hook to get contact ID from conversation ID
 */
export function useContactIdFromConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['contact-from-conversation', conversationId],
    queryFn: () => conversationId ? getContactIdFromConversation(conversationId) : null,
    enabled: !!conversationId,
  });
}

/**
 * Hook to get contact header details
 */
export function useContactHeader(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-header', contactId],
    queryFn: () => contactId ? getContactHeader(contactId) : null,
    enabled: !!contactId,
  });
}

/**
 * Get contact data for template variable replacement
 * Includes student and parent relationships
 */
export async function getContactForTemplate(contactId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id,
      contact_type,
      students (id, first_name, last_name, status, user_id),
      parents (
        id,
        first_name,
        last_name,
        parents_students (
          students (id, first_name, last_name, status, user_id)
        )
      ),
      staff (id, first_name, last_name, role, email, user_id)
    `)
    .eq('id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Hook to get contact data for template variables
 */
export function useContactForTemplate(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-for-template', contactId],
    queryFn: () => contactId ? getContactForTemplate(contactId) : null,
    enabled: !!contactId,
  });
}

/**
 * Get conversation ID for a contact (for pop-out functionality)
 * Returns the first OPEN or SNOOZED conversation for the contact
 */
export async function getConversationIdForContact(contactId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .in('status', ['OPEN', 'SNOOZED'])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}



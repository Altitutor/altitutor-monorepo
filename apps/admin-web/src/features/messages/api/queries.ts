'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { messagesKeys } from './queryKeys';
import {
  isContactConversation,
  type Sender,
  type AggregatedConversation,
  type ConversationListItem,
  type GroupConversation,
} from '../types';
import type { Tables } from '@altitutor/shared';

// Re-export types for backward compatibility
export type { Sender, AggregatedConversation } from '../types';

const PAGE_SIZE = 30;
/** Bound inbox list fetches; navbar badge uses a separate exact count RPC. */
const CONVERSATION_LIST_LIMIT = 500;

type ConversationRow = {
  id: string;
  status: string;
  last_message_at: string | null;
  last_message_id: string | null;
  last_message_direction: string | null;
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
  } | null;
  owned_numbers: Pick<Tables<'owned_numbers'>, 'id' | 'phone_e164' | 'label'> | null;
  conversation_reads: Array<Pick<Tables<'conversation_reads'>, 'id' | 'last_read_message_id' | 'last_read_at'>>;
  group_chat_participants?: Array<{
    contact_id: string;
    contacts: {
      phone_e164: string | null;
      students: Pick<Tables<'students'>, 'first_name' | 'last_name'> | null;
      parents: Pick<Tables<'parents'>, 'first_name' | 'last_name'> | null;
      staff: Pick<Tables<'staff'>, 'first_name' | 'last_name'> | null;
    } | null;
  }>;
};

type LastMessageSummary = {
  id: string;
  direction: string;
};

function lastMessageFromConversation(conv: {
  last_message_id: string | null;
  last_message_direction: string | null;
}): LastMessageSummary | null {
  if (!conv.last_message_id || !conv.last_message_direction) return null;
  return { id: conv.last_message_id, direction: conv.last_message_direction };
}

export async function fetchUnreadConversationCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_unread_contact_conversation_count');
  if (error) throw error;
  return data ?? 0;
}

export function useUnreadConversationCount() {
  return useQuery({
    queryKey: messagesKeys.unreadCount(),
    queryFn: fetchUnreadConversationCount,
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 30,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: messagesKeys.conversations(),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      
      // Fetch conversations with nested data
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, status, last_message_at, last_message_id, last_message_direction,
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
      
      return ((data || []) as ConversationRow[]).map((conv) => ({
        ...conv,
        messages: lastMessageFromConversation(conv),
      }));
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
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
      
      return {
        items: messages.map((message) => ({
          ...message,
          sender: null,
          conversation_owned_number_id: null,
        })),
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    staleTime: 1000 * 15,
    retry: 1, // Only retry once instead of 3 times
    refetchOnWindowFocus: true,
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
export async function getExistingConversationForRelated(
  relatedId: string,
  type: 'student' | 'staff' | 'parent',
  requestedOwnedNumberId?: string
): Promise<string | null> {
  const contactId = await getContactIdByRelatedId(relatedId, type);
  if (!contactId) {
    return null;
  }
  
  const supabase = getSupabaseClient();
  
  let ownedNumberId = requestedOwnedNumberId;
  if (!ownedNumberId) {
    const { data: owned } = await supabase
      .from('owned_numbers')
      .select('id')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();
    ownedNumberId = owned?.id;
  }
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

export async function fetchLastInboundOwnedNumberId(
  contactId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select('id, owned_number_id')
    .eq('contact_id', contactId)
    .in('status', ['OPEN', 'SNOOZED']);

  if (conversationsError) throw conversationsError;

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  if (conversationIds.length === 0) return null;

  const ownedNumberByConversationId = new Map(
    (conversations ?? []).map((conversation) => [conversation.id, conversation.owned_number_id])
  );

  const { data: lastInbound, error: messagesError } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('direction', 'INBOUND')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (messagesError) throw messagesError;
  if (!lastInbound?.conversation_id) return null;

  return ownedNumberByConversationId.get(lastInbound.conversation_id) ?? null;
}

export function useLastInboundOwnedNumberId(contactId: string | null) {
  return useQuery({
    queryKey: messagesKeys.lastInboundOwnedNumber(contactId || ''),
    queryFn: () => (contactId ? fetchLastInboundOwnedNumberId(contactId) : null),
    enabled: !!contactId,
    staleTime: 1000 * 15,
  });
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

export async function fetchConversationList(
  ownedNumberId?: string | null
): Promise<ConversationListItem[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('conversations')
    .select(`
      id, status, last_message_at, last_message_id, last_message_direction,
      assigned_staff_id, contact_id, owned_number_id,
      is_group_chat, group_chat_id, group_chat_name,
      needs_follow_up,
      contacts(
        id, phone_e164, contact_type, student_id, parent_id, staff_id,
        students(id, first_name, last_name),
        parents(id, first_name, last_name),
        staff(id, first_name, last_name)
      ),
      group_chat_participants(
        contact_id,
        contacts(
          phone_e164,
          students(first_name, last_name),
          parents(first_name, last_name),
          staff(first_name, last_name)
        )
      ),
      owned_numbers(id, phone_e164, alphanumeric_sender_id, sender_type, label, provider),
      conversation_reads(id, last_read_message_id, last_read_at)
    `)
    .in('status', ['OPEN', 'SNOOZED'])
    .order('last_message_at', { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT);

  if (ownedNumberId) {
    query = query.eq('owned_number_id', ownedNumberId);
  }

  const { data: conversations, error } = await query;

  if (error) throw error;

  const typedConversations = (conversations || []) as ConversationWithLastMessage[];

  const byContact = new Map<string, AggregatedConversation>();
  const groups: GroupConversation[] = [];

  for (const conv of typedConversations) {
    const contactId = conv.contact_id;
    const lastMessage = lastMessageFromConversation(conv);

    if (conv.is_group_chat && conv.group_chat_id) {
      const participantNames = (conv.group_chat_participants ?? []).map((participant) => {
        const contact = participant.contacts;
        const person = contact?.students ?? contact?.parents ?? contact?.staff;
        const name = person
          ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
          : '';
        return name || contact?.phone_e164 || 'Unknown participant';
      });
      groups.push({
        kind: 'group',
        conversationId: conv.id,
        groupChatId: conv.group_chat_id,
        groupName: conv.group_chat_name,
        participantNames,
        ownedNumberId: conv.owned_number_id,
        latestMessageAt: conv.last_message_at,
        latestMessage: lastMessage,
        // Match navbar badge: unread only when tip is inbound and unread.
        unreadCount:
          !conv.conversation_reads?.length && lastMessage?.direction === 'INBOUND'
            ? 1
            : 0,
      });
      continue;
    }

    if (!contactId || !conv.contacts) continue;

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
    aggregated.conversations.push({
      id: conv.id,
      owned_number_id: conv.owned_number_id,
      owned_number: conv.owned_numbers,
      last_message_at: conv.last_message_at,
      last_message_id: conv.last_message_id,
      last_message: lastMessage,
      status: conv.status,
      needs_follow_up: conv.needs_follow_up ?? false,
    });

    if (conv.last_message_at && (!aggregated.latestMessageAt || conv.last_message_at > aggregated.latestMessageAt)) {
      aggregated.latestMessageAt = conv.last_message_at;
      aggregated.latestMessage = lastMessage;
    }

    // Outbound tip / history-only threads are not unread (badge uses the same rule).
    if (
      (!conv.conversation_reads || conv.conversation_reads.length === 0) &&
      lastMessage?.direction === 'INBOUND'
    ) {
      aggregated.unreadCount++;
    }
  }

  const contacts: ConversationListItem[] = Array.from(byContact.values()).map((item) => ({
    ...item,
    kind: 'contact' as const,
  }));

  return [...contacts, ...groups].sort((a, b) => {
    if (!a.latestMessageAt && !b.latestMessageAt) return 0;
    if (!a.latestMessageAt) return 1;
    if (!b.latestMessageAt) return -1;
    return b.latestMessageAt.localeCompare(a.latestMessageAt);
  });
}

export async function fetchConversationsByContact(
  ownedNumberId?: string | null
): Promise<AggregatedConversation[]> {
  return (await fetchConversationList(ownedNumberId)).filter(isContactConversation);
}

export function useConversationsByContact(
  ownedNumberId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: messagesKeys.conversationsByContact(ownedNumberId),
    queryFn: () => fetchConversationsByContact(ownedNumberId),
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}

export function useConversationList(
  ownedNumberId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...messagesKeys.conversationsByContact(ownedNumberId), 'including-groups'],
    queryFn: () => fetchConversationList(ownedNumberId),
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
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

export function useMessagesForContact(contactId: string | null, ownedNumberId?: string | null) {
  return useInfiniteQuery({
    queryKey: messagesKeys.messagesForContact(contactId || '', ownedNumberId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!contactId) return { items: [], nextCursor: undefined };
      
      const supabase = getSupabaseClient();
      
      // Get all conversation IDs for this contact
      let conversationsQuery = supabase
        .from('conversations')
        .select('id, owned_number_id, owned_numbers(id, phone_e164, alphanumeric_sender_id, sender_type, label, provider)')
        .eq('contact_id', contactId)
        .in('status', ['OPEN', 'SNOOZED']);

      if (ownedNumberId) {
        conversationsQuery = conversationsQuery.eq('owned_number_id', ownedNumberId);
      }

      const { data: conversations, error: convError } = await conversationsQuery;
      
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
    staleTime: 1000 * 15,
    retry: 1,
    refetchOnWindowFocus: true,
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



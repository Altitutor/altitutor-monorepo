// @ts-nocheck
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Ensure an individual conversation exists
 * @param supabase Supabase client
 * @param contactId Contact ID
 * @param ownedNumberId Owned number ID
 * @returns Conversation ID
 */
export async function ensureConversation(
  supabase: SupabaseClient,
  contactId: string,
  ownedNumberId: string
): Promise<string> {
  // Try to find existing active conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('owned_number_id', ownedNumberId)
    .in('status', ['OPEN', 'SNOOZED'])
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // Create new conversation
  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({
      contact_id: contactId,
      owned_number_id: ownedNumberId,
      status: 'OPEN',
      is_group_chat: false,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  // Handle race condition: if duplicate key error, retry select
  if (createErr && createErr.code === '23505') {
    const { data: retry } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('owned_number_id', ownedNumberId)
      .in('status', ['OPEN', 'SNOOZED'])
      .maybeSingle();
    
    if (retry?.id) return retry.id;
  }

  if (createErr) throw createErr;
  if (!created?.id) throw new Error('Failed to create conversation');
  
  return created.id as string;
}

/**
 * Ensure a group chat conversation exists
 * @param supabase Supabase client
 * @param groupChatId iMessage chatId (unique identifier)
 * @param groupChatName Display name for the group
 * @param ownedNumberId Owned number ID
 * @param participantContactIds Array of contact IDs in the group
 * @returns Conversation ID
 */
export async function ensureGroupChatConversation(
  supabase: SupabaseClient,
  groupChatId: string,
  groupChatName: string,
  ownedNumberId: string,
  participantContactIds: string[]
): Promise<string> {
  // Try to find existing active group chat conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('group_chat_id', groupChatId)
    .eq('owned_number_id', ownedNumberId)
    .eq('is_group_chat', true)
    .in('status', ['OPEN', 'SNOOZED'])
    .maybeSingle();

  let conversationId: string;

  if (existing?.id) {
    conversationId = existing.id;
  } else {
    // Create new group chat conversation
    const { data: created, error: createErr } = await supabase
      .from('conversations')
      .insert({
        group_chat_id: groupChatId,
        group_chat_name: groupChatName,
        owned_number_id: ownedNumberId,
        status: 'OPEN',
        is_group_chat: true,
        contact_id: null, // Group chats don't have a single contact
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    // Handle race condition
    if (createErr && createErr.code === '23505') {
      const { data: retry } = await supabase
        .from('conversations')
        .select('id')
        .eq('group_chat_id', groupChatId)
        .eq('owned_number_id', ownedNumberId)
        .eq('is_group_chat', true)
        .in('status', ['OPEN', 'SNOOZED'])
        .maybeSingle();
      
      if (retry?.id) {
        conversationId = retry.id;
      } else {
        throw createErr;
      }
    } else if (createErr) {
      throw createErr;
    } else if (!created?.id) {
      throw new Error('Failed to create group chat conversation');
    } else {
      conversationId = created.id as string;
    }
  }

  // Ensure all participants exist in group_chat_participants table
  for (const contactId of participantContactIds) {
    await addGroupChatParticipant(supabase, conversationId, contactId);
  }

  return conversationId;
}

/**
 * Add a participant to a group chat
 * @param supabase Supabase client
 * @param conversationId Conversation ID
 * @param contactId Contact ID to add
 */
export async function addGroupChatParticipant(
  supabase: SupabaseClient,
  conversationId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('group_chat_participants')
    .insert({
      conversation_id: conversationId,
      contact_id: contactId,
    })
    .select('id')
    .maybeSingle();

  // Ignore duplicate key errors (participant already exists)
  if (error && error.code !== '23505') {
    throw error;
  }
}

// @ts-nocheck
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface MessageInsert {
  conversation_id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  from_number_e164?: string | null;
  to_number_e164: string;
  status: string;
  message_sid?: string | null;
  imessage_guid?: string | null;
  received_at?: string | null;
  sent_at?: string | null;
  is_reaction?: boolean;
  reaction_type?: string | null;
  associated_message_guid?: string | null;
}

export interface AttachmentInsert {
  storage_url: string;
  filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
}

/**
 * Insert a message with optional attachments
 * @param supabase Supabase client
 * @param message Message data
 * @param attachments Optional array of attachments
 * @returns Message ID
 */
export async function insertMessage(
  supabase: SupabaseClient,
  message: MessageInsert,
  attachments?: AttachmentInsert[]
): Promise<string> {
  // Insert message
  const { data: inserted, error: msgErr } = await supabase
    .from('messages')
    .insert(message)
    .select('id')
    .single();

  if (msgErr) throw msgErr;
  if (!inserted?.id) throw new Error('Failed to insert message');

  const messageId = inserted.id as string;

  // Insert attachments if provided
  if (attachments && attachments.length > 0) {
    const attachmentInserts = attachments.map(att => ({
      message_id: messageId,
      storage_url: att.storage_url,
      filename: att.filename || null,
      mime_type: att.mime_type || null,
      size_bytes: att.size_bytes || null,
    }));

    const { error: attErr } = await supabase
      .from('message_attachments')
      .insert(attachmentInserts);

    if (attErr) {
      console.error('[insertMessage] Failed to insert attachments', attErr);
      // Don't throw - message was inserted successfully
    }
  }

  return messageId;
}

/**
 * Load message data required for sending
 * Returns message, conversation, contact (if individual), and owned number
 */
export interface MessageSendData {
  message: {
    id: string;
    body: string;
    conversation_id: string;
  };
  conversation: {
    id: string;
    contact_id: string | null;
    owned_number_id: string;
    is_group_chat: boolean;
    group_chat_id: string | null;
  };
  contact: {
    phone_e164: string | null;
    email: string | null;
  } | null;
  ownedNumber: {
    id: string;
    phone_e164: string;
    provider: 'TWILIO' | 'IMESSAGE';
    messaging_service_sid: string | null;
    alphanumeric_sender_id: string | null;
    sender_type: 'PHONE' | 'ALPHANUMERIC';
    imessage_api_key: string | null;
  };
}

export async function loadMessageSendData(
  supabase: SupabaseClient,
  messageId: string
): Promise<MessageSendData> {
  // Load message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .select('id, body, conversation_id')
    .eq('id', messageId)
    .maybeSingle();
  
  if (msgErr || !message) {
    throw msgErr || new Error('message not found');
  }

  // Load conversation
  const { data: convo, error: cErr } = await supabase
    .from('conversations')
    .select('id, contact_id, owned_number_id, is_group_chat, group_chat_id')
    .eq('id', message.conversation_id)
    .maybeSingle();
  
  if (cErr || !convo) {
    throw cErr || new Error('conversation not found');
  }

  // Load owned number (with provider check)
  const { data: owned, error: onErr } = await supabase
    .from('owned_numbers')
    .select('id, phone_e164, provider, messaging_service_sid, alphanumeric_sender_id, sender_type, imessage_api_key')
    .eq('id', convo.owned_number_id)
    .maybeSingle();
  
  if (onErr || !owned) {
    throw onErr || new Error('owned number not found');
  }

  // Load contact if individual chat
  let contact: { phone_e164: string | null; email: string | null } | null = null;
  if (!convo.is_group_chat && convo.contact_id) {
    const { data: contactData, error: ctErr } = await supabase
      .from('contacts')
      .select('phone_e164, email')
      .eq('id', convo.contact_id)
      .maybeSingle();
    
    if (ctErr) {
      throw ctErr;
    }
    contact = contactData || null;
  }

  return {
    message: {
      id: message.id,
      body: message.body,
      conversation_id: message.conversation_id,
    },
    conversation: {
      id: convo.id,
      contact_id: convo.contact_id,
      owned_number_id: convo.owned_number_id,
      is_group_chat: convo.is_group_chat || false,
      group_chat_id: convo.group_chat_id || null,
    },
    contact,
    ownedNumber: {
      id: owned.id,
      phone_e164: owned.phone_e164,
      provider: owned.provider as 'TWILIO' | 'IMESSAGE',
      messaging_service_sid: owned.messaging_service_sid || null,
      alphanumeric_sender_id: owned.alphanumeric_sender_id || null,
      sender_type: owned.sender_type as 'PHONE' | 'ALPHANUMERIC',
      imessage_api_key: owned.imessage_api_key || null,
    },
  };
}

/**
 * Update message status (helper for error handling)
 */
export async function updateMessageStatus(
  supabase: SupabaseClient,
  messageId: string,
  status: 'FAILED' | 'SENT' | 'SENDING',
  updates?: {
    message_sid?: string | null;
    imessage_guid?: string | null;
    sent_at?: string;
    from_number_e164?: string | null;
    to_number_e164?: string;
    error_message?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    status_updated_at: new Date().toISOString(),
  };

  if (updates) {
    if (updates.message_sid !== undefined) updateData.message_sid = updates.message_sid;
    if (updates.imessage_guid !== undefined) updateData.imessage_guid = updates.imessage_guid;
    if (updates.sent_at !== undefined) updateData.sent_at = updates.sent_at;
    if (updates.from_number_e164 !== undefined) updateData.from_number_e164 = updates.from_number_e164;
    if (updates.to_number_e164 !== undefined) updateData.to_number_e164 = updates.to_number_e164;
    if (updates.error_message !== undefined) updateData.error_message = updates.error_message;
  }

  const { error } = await supabase
    .from('messages')
    .update(updateData)
    .eq('id', messageId);

  if (error) {
    throw error;
  }
}

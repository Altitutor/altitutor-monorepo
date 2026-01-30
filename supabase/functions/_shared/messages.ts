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

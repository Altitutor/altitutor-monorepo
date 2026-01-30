// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { findOrCreateContact } from '../_shared/contacts.ts';
import { ensureConversation, ensureGroupChatConversation, addGroupChatParticipant } from '../_shared/conversations.ts';
import { insertMessage } from '../_shared/messages.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const acrh = req.headers.get('access-control-request-headers') || '';
    const requestHeaders = (acrh || 'content-type, authorization').toLowerCase();
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': requestHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    } });
  }

  try {
    // Webhook authentication
    const webhookSecret = Deno.env.get('IMESSAGE_WEBHOOK_SECRET');
    const authHeader = req.headers.get('Authorization');
    
    if (!webhookSecret) {
      console.error('[imessage-inbound] IMESSAGE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'webhook secret not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.error('[imessage-inbound] Authentication failed', { 
        provided: authHeader ? 'Bearer ***' : 'none',
        expected: 'Bearer ***'
      });
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Parse payload (JSON format from iMessage bridge)
    const body = await req.json();
    
    const from = body.From as string;
    const to = body.To as string; // This is chatId for groups, phone/email for individuals
    const text = body.Body as string;
    const messageGuid = body.MessageGuid as string;
    const messageId = body.MessageId as string;
    const isGroupChat = body.IsGroupChat === true;
    const chatId = body.ChatId as string; // iMessage chatId
    const senderName = body.SenderName as string | null;
    const isReaction = body.IsReaction === true;
    const reactionType = body.ReactionType as string | null;
    const isReactionRemoval = body.IsReactionRemoval === true;
    const associatedMessageGuid = body.AssociatedMessageGuid as string | null;
    const attachments = (body.Attachments || []) as Array<{
      url: string;
      type: string;
      filename: string;
      size: number;
    }>;
    const date = body.Date as string; // ISO 8601 timestamp

    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'missing from/to' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!messageGuid) {
      return new Response(JSON.stringify({ error: 'missing MessageGuid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createSupabaseClient();

    // Find owned number (iMessage number +61483849842)
    // For group chats, 'to' is the chatId, so we need to find by provider
    // For individual chats, 'to' might be the phone number or we need to find iMessage number
    const { data: owned, error: ownErr } = await supabase
      .from('owned_numbers')
      .select('id, phone_e164')
      .eq('provider', 'IMESSAGE')
      .maybeSingle();
    
    if (ownErr || !owned?.id) {
      console.error('[imessage-inbound] iMessage owned number not found', ownErr);
      throw ownErr || new Error('iMessage owned number not configured');
    }

    let conversationId: string;
    let senderContactId: string;

    if (isGroupChat) {
      // Handle group chat
      // Find or create contact for sender
      const isEmail = from.includes('@');
      senderContactId = await findOrCreateContact(
        supabase,
        isEmail ? undefined : from,
        isEmail ? from : undefined
      );

      // Ensure group chat conversation exists
      // Use chatId from payload (or 'to' if chatId not provided)
      const groupChatId = chatId || to;
      const groupChatName = senderName || 'Group Chat';
      
      conversationId = await ensureGroupChatConversation(
        supabase,
        groupChatId,
        groupChatName,
        owned.id,
        [senderContactId] // Start with sender, others will be added as they message
      );

      // Ensure sender is a participant
      await addGroupChatParticipant(supabase, conversationId, senderContactId);
    } else {
      // Handle individual chat
      // Find or create contact for sender
      const isEmail = from.includes('@');
      senderContactId = await findOrCreateContact(
        supabase,
        isEmail ? undefined : from,
        isEmail ? from : undefined
      );

      // Ensure conversation exists
      conversationId = await ensureConversation(supabase, senderContactId, owned.id);
    }

    // Check if message already exists (by imessage_guid to avoid duplicates)
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('imessage_guid', messageGuid)
      .maybeSingle();

    if (existingMessage?.id) {
      console.log('[imessage-inbound] Message already exists', { messageGuid });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Prepare attachments
    const attachmentInserts = attachments.map(att => ({
      storage_url: att.url,
      filename: att.filename || null,
      mime_type: att.type || null,
      size_bytes: att.size || null,
    }));

    // Determine from/to numbers for message
    // For group chats, from is sender, to is the owned number
    // For individual chats, from is sender, to is owned number
    const toNumber = isGroupChat ? owned.phone_e164 : (owned.phone_e164 || to);
    const fromNumber = from.includes('@') ? null : from; // NULL for email senders

    // Insert message
    await insertMessage(supabase, {
      conversation_id: conversationId,
      direction: 'INBOUND',
      body: text || '',
      from_number_e164: fromNumber,
      to_number_e164: toNumber,
      status: 'RECEIVED',
      received_at: date || new Date().toISOString(),
      message_sid: messageId || null,
      imessage_guid: messageGuid,
      is_reaction: isReaction || false,
      reaction_type: reactionType || null,
      associated_message_guid: associatedMessageGuid || null,
    }, attachmentInserts);

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: date || new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[imessage-inbound] Error', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

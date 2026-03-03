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
    const isFromMe = body.IsFromMe === true;
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

    // Log full webhook payload for debugging
    console.log('[imessage-inbound] Webhook payload received', {
      From: from,
      To: to,
      Body: text ? `${text.substring(0, 100)}${text.length > 100 ? '...' : ''}` : '(empty)',
      MessageGuid: messageGuid,
      MessageId: messageId,
      IsGroupChat: isGroupChat,
      ChatId: chatId,
      SenderName: senderName,
      IsFromMe: isFromMe,
      IsReaction: isReaction,
      ReactionType: reactionType,
      IsReactionRemoval: isReactionRemoval,
      AssociatedMessageGuid: associatedMessageGuid,
      AttachmentsCount: attachments.length,
      Date: date,
    });

    if (!messageGuid) {
      console.error('[imessage-inbound] Missing MessageGuid in payload', { body });
      return new Response(JSON.stringify({ error: 'missing MessageGuid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createSupabaseClient();

    // Find owned number (iMessage number +61483849842)
    const { data: owned, error: ownErr } = await supabase
      .from('owned_numbers')
      .select('id, phone_e164')
      .eq('provider', 'IMESSAGE')
      .maybeSingle();
    
    if (ownErr || !owned?.id) {
      console.error('[imessage-inbound] iMessage owned number not found', ownErr);
      throw ownErr || new Error('iMessage owned number not configured');
    }

    // Determine direction: OUTBOUND if sent by us, INBOUND otherwise
    const direction: 'INBOUND' | 'OUTBOUND' = isFromMe ? 'OUTBOUND' : 'INBOUND';
    console.log('[imessage-inbound] Processing message', { 
      messageGuid, 
      direction, 
      isFromMe, 
      isGroupChat,
      hasAttachments: attachments.length > 0,
      from,
      to,
      conversationType: isGroupChat ? 'group' : 'individual'
    });

    let conversationId: string;
    let recipientContactId: string | null = null;

    if (isGroupChat) {
      // Handle group chat
      const groupChatId = chatId || to;
      const groupChatName = senderName || 'Group Chat';
      
      if (isFromMe) {
        // OUTBOUND group chat: we sent it, so find/create contact for recipient
        // For group chats, we need to find participants from the group
        // Since we're sending TO the group, the conversation should already exist
        // But we need to ensure it exists with the group chat ID
        conversationId = await ensureGroupChatConversation(
          supabase,
          groupChatId,
          groupChatName,
          owned.id,
          [] // Participants will be added as they message
        );
      } else {
        // INBOUND group chat: find/create contact for sender
        const isEmail = from.includes('@');
        recipientContactId = await findOrCreateContact(
          supabase,
          isEmail ? undefined : from,
          isEmail ? from : undefined
        );

        conversationId = await ensureGroupChatConversation(
          supabase,
          groupChatId,
          groupChatName,
          owned.id,
          [recipientContactId] // Start with sender, others will be added as they message
        );

        // Ensure sender is a participant
        await addGroupChatParticipant(supabase, conversationId, recipientContactId);
      }
    } else {
      // Handle individual chat
      if (isFromMe) {
        // OUTBOUND individual chat: we sent it TO the recipient
        // 'to' field contains the recipient's phone/email
        if (!to) {
          return new Response(JSON.stringify({ error: 'missing recipient (to) for OUTBOUND message' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        const isEmail = to.includes('@');
        recipientContactId = await findOrCreateContact(
          supabase,
          isEmail ? undefined : to,
          isEmail ? to : undefined
        );

        // Ensure conversation exists
        conversationId = await ensureConversation(supabase, recipientContactId, owned.id);
      } else {
        // INBOUND individual chat: find/create contact for sender
        if (!from) {
          return new Response(JSON.stringify({ error: 'missing sender (from) for INBOUND message' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        const isEmail = from.includes('@');
        recipientContactId = await findOrCreateContact(
          supabase,
          isEmail ? undefined : from,
          isEmail ? from : undefined
        );

        // Ensure conversation exists
        conversationId = await ensureConversation(supabase, recipientContactId, owned.id);
      }
    }

    // Check if message already exists (by imessage_guid to avoid duplicates)
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, direction, imessage_guid, from_number_e164, to_number_e164, body, created_at')
      .eq('imessage_guid', messageGuid)
      .maybeSingle();

    if (existingMessage?.id) {
      console.log('[imessage-inbound] Message already exists - DUPLICATE DETECTED', {
        messageGuid,
        incomingDirection: direction,
        existingMessageId: existingMessage.id,
        existingDirection: existingMessage.direction,
        existingFrom: existingMessage.from_number_e164,
        existingTo: existingMessage.to_number_e164,
        existingBody: existingMessage.body ? `${existingMessage.body.substring(0, 50)}...` : '(empty)',
        existingCreatedAt: existingMessage.created_at,
        incomingFrom: from,
        incomingTo: to,
        incomingIsFromMe: isFromMe,
        isGUIDCollision: existingMessage.direction !== direction,
      });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Also check for OUTBOUND messages in the same conversation that might not have GUID set yet
    // This handles race condition where webhook arrives before GUID is set on OUTBOUND message
    // Only check this for OUTBOUND messages (when isFromMe is true)
    if (isFromMe) {
      const { data: recentOutbound } = await supabase
        .from('messages')
        .select('id, direction, imessage_guid, body, created_at')
        .eq('conversation_id', conversationId)
        .eq('direction', 'OUTBOUND')
        .is('imessage_guid', null)
        .order('created_at', { ascending: false })
        .limit(5)
        .maybeSingle();

      if (recentOutbound?.id) {
        // Check if this might be the same message (same body, recent timestamp)
        const recentTime = new Date(recentOutbound.created_at).getTime();
        const webhookTime = date ? new Date(date).getTime() : Date.now();
        const timeDiff = Math.abs(webhookTime - recentTime);
        
        // If messages are within 10 seconds and have same body (or both have attachments), likely duplicate
        if (timeDiff < 10000 && (
          (text && recentOutbound.body === text) ||
          (attachments.length > 0 && !text && !recentOutbound.body)
        )) {
          console.log('[imessage-inbound] Duplicate OUTBOUND message detected (race condition)', { messageGuid });
          return new Response(JSON.stringify({ ok: true, duplicate: true, reason: 'outbound_race' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    // Prepare attachments
    const attachmentInserts = attachments.map(att => ({
      storage_url: att.url,
      filename: att.filename || null,
      mime_type: att.type || null,
      size_bytes: att.size || null,
    }));

    // Determine from/to numbers for message based on direction
    let fromNumber: string | null;
    let toNumber: string;

    if (isFromMe) {
      // OUTBOUND: from is owned number, to is recipient
      fromNumber = owned.phone_e164;
      if (isGroupChat) {
        // For group chats, store the chatId or owned number as 'to'
        toNumber = chatId || to || owned.phone_e164;
      } else {
        // For individual chats, 'to' is the recipient's phone/email
        toNumber = to || owned.phone_e164;
      }
    } else {
      // INBOUND: from is sender, to is owned number
      fromNumber = from.includes('@') ? null : from; // NULL for email senders
      toNumber = isGroupChat ? owned.phone_e164 : (owned.phone_e164 || to);
    }

    // Insert message with appropriate direction and status
    const messageData: Record<string, unknown> = {
      conversation_id: conversationId,
      direction: direction,
      body: text || '',
      from_number_e164: fromNumber,
      to_number_e164: toNumber,
      status: isFromMe ? 'SENT' : 'RECEIVED',
      message_sid: messageId || null,
      imessage_guid: messageGuid,
      is_reaction: isReaction || false,
      reaction_type: reactionType || null,
      associated_message_guid: associatedMessageGuid || null,
    };

    // Set appropriate timestamp based on direction
    const timestamp = date || new Date().toISOString();
    if (isFromMe) {
      messageData.sent_at = timestamp;
    } else {
      messageData.received_at = timestamp;
    }

    const insertedMessageId = await insertMessage(supabase, messageData, attachmentInserts);

    console.log('[imessage-inbound] Message inserted successfully', {
      messageId: insertedMessageId,
      messageGuid,
      direction,
      conversationId,
      fromNumber,
      toNumber,
      bodyLength: text?.length || 0,
      attachmentsCount: attachments.length,
    });

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: date || new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    const ext = e && typeof e === 'object' ? e as { messageGuid?: string; from?: string; to?: string } : {};
    console.error('[imessage-inbound] Error processing webhook', {
      error: err.message || e,
      stack: err.stack,
      messageGuid: ext.messageGuid || 'unknown',
      from: ext.from || 'unknown',
      to: ext.to || 'unknown',
    });
    return new Response(JSON.stringify({ error: err.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

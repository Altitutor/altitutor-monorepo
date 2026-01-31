// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { findOrCreateContact } from '../_shared/contacts.ts';
import { ensureConversation, ensureGroupChatConversation, addGroupChatParticipant } from '../_shared/conversations.ts';
import { insertMessage } from '../_shared/messages.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    } });
  }

  try {
    // Simple authentication - require authorization header with service role key or API key
    const authHeader = req.headers.get('Authorization');
    const expectedAuth = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SYNC_API_KEY');
    
    if (!authHeader || authHeader !== `Bearer ${expectedAuth}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createSupabaseClient();
    const bridgeUrl = Deno.env.get('IMESSAGE_BRIDGE_URL') || 'https://api.altitutor.com';
    const apiKey = Deno.env.get('IMESSAGE_API_KEY');
    
    if (!apiKey) {
      throw new Error('IMESSAGE_API_KEY not configured');
    }

    // Find iMessage owned number
    const { data: owned, error: ownErr } = await supabase
      .from('owned_numbers')
      .select('id, phone_e164')
      .eq('provider', 'IMESSAGE')
      .maybeSingle();
    
    if (ownErr || !owned?.id) {
      throw new Error('iMessage owned number not configured');
    }

    // Calculate date 90 days ago
    const since = new Date();
    since.setDate(since.getDate() - 90);

    console.log('[sync-imessage-history] Starting sync', { since: since.toISOString() });

    let allMessages: any[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    // Fetch messages in batches
    while (hasMore) {
      const url = `${bridgeUrl}/messages/?since=${since.toISOString()}&limit=${limit}&offset=${offset}`;
      console.log('[sync-imessage-history] Fetching batch', { offset, limit });

      const response = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`iMessage bridge API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const messages = data.messages || [];
      
      if (messages.length === 0) {
        hasMore = false;
      } else {
        allMessages = allMessages.concat(messages);
        offset += messages.length;
        
        // If we got fewer than limit, we're done
        if (messages.length < limit) {
          hasMore = false;
        }
      }
    }

    console.log('[sync-imessage-history] Fetched messages', { count: allMessages.length });

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Process each message
    for (const msg of allMessages) {
      try {
        const messageGuid = msg.guid;
        const isGroupChat = msg.isGroupChat === true;
        const from = msg.sender;
        const chatId = msg.chatId;
        const text = msg.text || '';
        const date = msg.date;
        const attachments = msg.attachments || [];
        const isReaction = msg.isReaction === true;
        const reactionType = msg.reactionType || null;
        const associatedMessageGuid = msg.associatedMessageGuid || null;

        // Check if message already exists
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('imessage_guid', messageGuid)
          .maybeSingle();

        if (existing?.id) {
          skipped++;
          continue;
        }

        let conversationId: string;
        let senderContactId: string;

        if (isGroupChat) {
          // Handle group chat
          const isEmail = from.includes('@');
          senderContactId = await findOrCreateContact(
            supabase,
            isEmail ? undefined : from,
            isEmail ? from : undefined
          );

          // Get group chat name (might need to query chats endpoint)
          // For now, use a default name
          const groupChatName = msg.chatDisplayName || 'Group Chat';
          
          conversationId = await ensureGroupChatConversation(
            supabase,
            chatId,
            groupChatName,
            owned.id,
            [senderContactId]
          );

          await addGroupChatParticipant(supabase, conversationId, senderContactId);
        } else {
          // Handle individual chat
          const isEmail = from.includes('@');
          senderContactId = await findOrCreateContact(
            supabase,
            isEmail ? undefined : from,
            isEmail ? from : undefined
          );

          conversationId = await ensureConversation(senderContactId, owned.id);
        }

        // Prepare attachments
        const attachmentInserts = attachments.map((att: any) => ({
          storage_url: att.url || att.path || '',
          filename: att.filename || null,
          mime_type: att.mimeType || att.type || null,
          size_bytes: att.size || null,
        }));

        // Determine from/to numbers
        const toNumber = isGroupChat ? owned.phone_e164 : (owned.phone_e164 || chatId);
        const fromNumber = from.includes('@') ? null : from;

        // Insert message
        await insertMessage(supabase, {
          conversation_id: conversationId,
          direction: 'INBOUND',
          body: text || '',
          from_number_e164: fromNumber,
          to_number_e164: toNumber,
          status: 'RECEIVED',
          received_at: date || new Date().toISOString(),
          message_sid: msg.id?.toString() || null,
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

        synced++;
      } catch (e: any) {
        console.error('[sync-imessage-history] Error processing message', { guid: msg.guid, error: e?.message || e });
        errors++;
      }
    }

    console.log('[sync-imessage-history] Sync complete', { synced, skipped, errors, total: allMessages.length });

    return new Response(JSON.stringify({ 
      success: true, 
      synced, 
      skipped, 
      errors, 
      total: allMessages.length 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[sync-imessage-history] Error', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

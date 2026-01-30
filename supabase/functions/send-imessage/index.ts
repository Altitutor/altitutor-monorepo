// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

type SendBody = { messageId: string };

async function callIMessageSend(
  to: string | undefined,
  chatId: string | undefined,
  body: string,
  mediaUrls: string[],
  apiKey: string
) {
  const bridgeUrl = Deno.env.get('IMESSAGE_BRIDGE_URL') || 'https://api.altitutor.com';
  const url = `${bridgeUrl}/messages/`;

  const payload: any = {
    text: body,
  };

  if (chatId) {
    payload.chatId = chatId;
  } else if (to) {
    payload.to = to;
  } else {
    throw new Error('Either to or chatId must be provided');
  }

  if (mediaUrls && mediaUrls.length > 0) {
    payload.mediaUrls = mediaUrls;
  }

  console.log('[send-imessage] iMessage bridge request', {
    to: to || null,
    chatId: chatId || null,
    hasMedia: mediaUrls.length > 0,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('[send-imessage] iMessage bridge error', { status: res.status, json });
    throw new Error(json?.error || json?.message || 'iMessage bridge send error');
  }

  console.log('[send-imessage] iMessage bridge success', { 
    messageId: json?.messageId, 
    guid: json?.guid,
    sentAt: json?.sentAt 
  });
  
  return json; // includes messageId, guid, sentAt, etc.
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const acrh = req.headers.get('access-control-request-headers') || '';
    const requestHeaders = (acrh || 'authorization, x-client-info, apikey, content-type, x-supabase-authorization').toLowerCase();
    console.log('[send-imessage] CORS preflight', { acrh });
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': requestHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin, Access-Control-Request-Headers'
    } });
  }

  let messageId: string | undefined;
  
  try {
    const body = (await req.json()) as SendBody;
    messageId = body.messageId;
    console.log('[send-imessage] Entry', { messageId });
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId required' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }

    const supabase = createSupabaseClient();

    // Load message + conversation + contact + owned number
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .select('id, body, conversation_id')
      .eq('id', messageId)
      .maybeSingle();
    if (msgErr || !message) throw msgErr || new Error('message not found');
    console.log('[send-imessage] Loaded message', { id: message.id, conversation_id: message.conversation_id });

    const { data: convo, error: cErr } = await supabase
      .from('conversations')
      .select('id, contact_id, owned_number_id, is_group_chat, group_chat_id')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (cErr || !convo) throw cErr || new Error('conversation not found');
    console.log('[send-imessage] Loaded conversation', { 
      id: convo.id, 
      contact_id: convo.contact_id, 
      owned_number_id: convo.owned_number_id,
      is_group_chat: convo.is_group_chat,
      group_chat_id: convo.group_chat_id
    });

    const { data: owned, error: onErr } = await supabase
      .from('owned_numbers')
      .select('id, phone_e164, provider, imessage_api_key')
      .eq('id', convo.owned_number_id)
      .maybeSingle();
    if (onErr || !owned) throw onErr || new Error('owned number not found');

    // Verify this is an iMessage number
    if (owned.provider !== 'IMESSAGE') {
      throw new Error('Owned number is not an iMessage number');
    }

    // Get API key (use per-number override or environment variable)
    const apiKey = owned.imessage_api_key || Deno.env.get('IMESSAGE_API_KEY');
    if (!apiKey) {
      throw new Error('IMESSAGE_API_KEY not configured');
    }

    // Determine recipient: individual (to=phone/email) or group (chatId)
    let to: string | undefined;
    let chatId: string | undefined;

    if (convo.is_group_chat) {
      chatId = convo.group_chat_id || undefined;
      if (!chatId) {
        throw new Error('Group chat conversation missing group_chat_id');
      }
    } else {
      // Individual chat - get contact phone or email
      if (!convo.contact_id) {
        throw new Error('Individual chat conversation missing contact_id');
      }

      const { data: contact, error: ctErr } = await supabase
        .from('contacts')
        .select('phone_e164, email')
        .eq('id', convo.contact_id)
        .maybeSingle();
      if (ctErr || !contact) throw ctErr || new Error('contact not found');

      to = contact.phone_e164 || contact.email || undefined;
      if (!to) {
        throw new Error('Contact has no phone or email');
      }
      console.log('[send-imessage] Loaded contact', { to, isEmail: !!contact.email });
    }

    // Load attachments if any
    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('storage_url')
      .eq('message_id', messageId);

    const mediaUrls = (attachments || []).map(a => a.storage_url);

    // Call iMessage bridge API
    const result = await callIMessageSend(
      to,
      chatId,
      message.body,
      mediaUrls,
      apiKey
    );

    // Update message status to SENT (no delivery callbacks for iMessage)
    const { data: updatedRow, error: updErr } = await supabase
      .from('messages')
      .update({ 
        message_sid: result.messageId || result.guid || null,
        imessage_guid: result.guid || null,
        status: 'SENT', 
        status_updated_at: new Date().toISOString(), 
        sent_at: result.sentAt || new Date().toISOString(),
        from_number_e164: owned.phone_e164 || null,
        to_number_e164: to || chatId || ''
      })
      .eq('id', messageId)
      .select('id')
      .single();
    
    if (updErr || !updatedRow?.id) {
      console.error('[send-imessage] DB update error', updErr?.message || updErr);
      return new Response(JSON.stringify({ error: 'db_update_failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }
    console.log('[send-imessage] Updated message to SENT', { id: updatedRow.id, guid: result.guid });

    return new Response(JSON.stringify({ success: true, guid: result.guid, messageId: result.messageId }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin, Access-Control-Request-Headers' } });
  } catch (e: any) {
    console.error('[send-imessage] Error', e?.message || e);
    // Best effort: if we have messageId (captured before error), mark message as failed
    if (messageId) {
      try {
        const supabase = createSupabaseClient();
        await supabase
          .from('messages')
          .update({ status: 'FAILED', status_updated_at: new Date().toISOString(), error_message: String(e?.message || e) })
          .eq('id', messageId);
      } catch (updateErr) {
        console.error('[send-imessage] Failed to update message status', updateErr);
      }
    }
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin, Access-Control-Request-Headers' } });
  }
});

// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type SendBody = { messageId: string };

async function callTwilioSend(to: string, body: string, from?: string, messagingServiceSid?: string, statusCallback?: string) {
  const accountSidRaw = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
  const authTokenRaw = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
  const apiKeySidRaw = Deno.env.get('TWILIO_API_KEY_SID') || '';
  const apiKeySecretRaw = Deno.env.get('TWILIO_API_KEY_SECRET') || '';

  const accountSid = accountSidRaw.trim();
  const authToken = authTokenRaw.trim();
  const apiKeySid = apiKeySidRaw.trim();
  const apiKeySecret = apiKeySecretRaw.trim();

  // We require the account SID for the URL path; auth can be either Account SID/Auth Token OR API Key SID/Secret
  if (!accountSid) {
    throw new Error('Twilio credentials missing (TWILIO_ACCOUNT_SID)');
  }

  const basicUser = apiKeySid || accountSid;
  const basicPass = apiKeySid ? apiKeySecret : authToken;
  if (!basicUser || !basicPass) {
    throw new Error('Twilio credentials missing (username/password)');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', to);
  form.set('Body', body);
  if (statusCallback) form.set('StatusCallback', statusCallback);
  if (messagingServiceSid) {
    form.set('MessagingServiceSid', messagingServiceSid);
  } else if (from) {
    form.set('From', from);
  }
  console.log('[send-sms] Twilio request', {
    to,
    usingMessagingService: !!messagingServiceSid,
    from: from || null,
    hasStatusCallback: !!statusCallback,
    authMode: apiKeySid ? 'API_KEY' : 'ACCOUNT',
    accountSidSuffix: accountSid.slice(-6),
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${basicUser}:${basicPass}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('[send-sms] Twilio error', { status: res.status, json });
    throw new Error(json?.message || 'Twilio send error');
  }
  console.log('[send-sms] Twilio success', { sid: json?.sid, status: json?.status });
  return json; // includes sid, status, etc.
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const acrh = req.headers.get('access-control-request-headers') || '';
    const requestHeaders = (acrh || 'authorization, x-client-info, apikey, content-type, x-supabase-authorization').toLowerCase();
    console.log('[send-sms] CORS preflight', { acrh });
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
    console.log('[send-sms] Entry', { messageId });
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId required' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Load message + conversation + contact + owned number
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .select('id, body, conversation_id')
      .eq('id', messageId)
      .maybeSingle();
    if (msgErr || !message) throw msgErr || new Error('message not found');
    console.log('[send-sms] Loaded message', { id: message.id, conversation_id: message.conversation_id });

    const { data: convo, error: cErr } = await supabase
      .from('conversations')
      .select('id, contact_id, owned_number_id')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (cErr || !convo) throw cErr || new Error('conversation not found');
    console.log('[send-sms] Loaded conversation', { id: convo.id, contact_id: convo.contact_id, owned_number_id: convo.owned_number_id });

    const { data: contact, error: ctErr } = await supabase
      .from('contacts')
      .select('phone_e164')
      .eq('id', convo.contact_id)
      .maybeSingle();
    if (ctErr || !contact) throw ctErr || new Error('contact not found');
    console.log('[send-sms] Loaded contact', { to: contact.phone_e164 });

    const { data: owned, error: onErr } = await supabase
      .from('owned_numbers')
      .select('phone_e164, messaging_service_sid')
      .eq('id', convo.owned_number_id)
      .maybeSingle();
    if (onErr || !owned) throw onErr || new Error('owned number not found');
    console.log('[send-sms] Loaded owned number', { from: owned.phone_e164, messaging_service_sid: owned.messaging_service_sid || null });

    const statusCallback = new URL('/functions/v1/twilio-status', supabaseUrl).toString();
    const tw = await callTwilioSend(
      contact.phone_e164,
      message.body,
      owned.phone_e164 || undefined,
      owned.messaging_service_sid || undefined,
      statusCallback
    );

    const { data: updatedRow, error: updErr } = await supabase
      .from('messages')
      .update({ message_sid: tw.sid, status: 'SENDING', status_updated_at: new Date().toISOString(), sent_at: new Date().toISOString(), from_number_e164: owned.phone_e164 || null, to_number_e164: contact.phone_e164 })
      .eq('id', messageId)
      .select('id')
      .single();
    if (updErr || !updatedRow?.id) {
      console.error('[send-sms] DB update error', updErr.message || updErr);
      return new Response(JSON.stringify({ error: 'db_update_failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }
    console.log('[send-sms] Updated message to SENDING', { id: updatedRow.id, sid: tw.sid });

    return new Response(JSON.stringify({ success: true, sid: tw.sid }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin, Access-Control-Request-Headers' } });
  } catch (e: any) {
    console.error('[send-sms] Error', e?.message || e);
    // Best effort: if we have messageId (captured before error), mark message as failed
    if (messageId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
        await supabase
          .from('messages')
          .update({ status: 'FAILED', status_updated_at: new Date().toISOString(), error_message: String(e?.message || e) })
          .eq('id', messageId);
      } catch (updateErr) {
        console.error('[send-sms] Failed to update message status', updateErr);
      }
    }
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin, Access-Control-Request-Headers' } });
  }
});



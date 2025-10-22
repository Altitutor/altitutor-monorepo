// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type SendBody = { messageId: string };

async function callTwilioSend(to: string, body: string, from?: string, messagingServiceSid?: string, statusCallback?: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
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
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || 'Twilio send error');
  }
  return json; // includes sid, status, etc.
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { messageId } = (await req.json()) as SendBody;
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
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

    const { data: convo, error: cErr } = await supabase
      .from('conversations')
      .select('id, contact_id, owned_number_id')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (cErr || !convo) throw cErr || new Error('conversation not found');

    const { data: contact, error: ctErr } = await supabase
      .from('contacts')
      .select('phone_e164')
      .eq('id', convo.contact_id)
      .maybeSingle();
    if (ctErr || !contact) throw ctErr || new Error('contact not found');

    const { data: owned, error: onErr } = await supabase
      .from('owned_numbers')
      .select('phone_e164, messaging_service_sid')
      .eq('id', convo.owned_number_id)
      .maybeSingle();
    if (onErr || !owned) throw onErr || new Error('owned number not found');

    const statusCallback = new URL('/functions/v1/twilio-status', supabaseUrl).toString();
    const tw = await callTwilioSend(contact.phone_e164, message.body, owned.phone_e164 || undefined, owned.messaging_service_sid || undefined, statusCallback);

    await supabase
      .from('messages')
      .update({ message_sid: tw.sid, status: 'SENDING', status_updated_at: new Date().toISOString(), sent_at: new Date().toISOString(), from_number_e164: owned.phone_e164 || null, to_number_e164: contact.phone_e164 })
      .eq('id', messageId);

    return new Response(JSON.stringify({ success: true, sid: tw.sid }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});



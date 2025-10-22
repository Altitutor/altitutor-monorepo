// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

function parseFormEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) obj[key] = value;
  return obj;
}

function timingSafeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i];
  return result === 0;
}

async function verifyTwilioSignature(req: Request, bodyObj: Record<string, string>): Promise<boolean> {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) return true; // allow if not configured yet
  const signature = req.headers.get('X-Twilio-Signature') || '';

  // Build the string: full URL + concatenated params (sorted by key)
  const url = new URL(req.url).toString();
  const keys = Object.keys(bodyObj).sort();
  const data = url + keys.map((k) => bodyObj[k] ?? '').join('');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return timingSafeEqual(signature, expected);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const raw = await req.text();
    const body = contentType.includes('application/x-www-form-urlencoded') ? parseFormEncoded(raw) : (raw ? JSON.parse(raw) : {});

    // Optional signature verification
    const okSig = await verifyTwilioSignature(req, body);
    if (!okSig) {
      return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const from = body.From as string;
    const to = body.To as string;
    const text = body.Body as string;
    const messageSid = body.MessageSid as string;

    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'missing from/to' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Upsert/find contact by phone
    const { data: contactExisting } = await supabase
      .from('contacts')
      .select('id, display_name')
      .eq('phone_e164', from)
      .maybeSingle();

    let contactId = contactExisting?.id as string | undefined;
    if (!contactId) {
      const { data: inserted, error: insErr } = await supabase
        .from('contacts')
        .insert({ display_name: from, contact_type: 'LEAD', phone_e164: from })
        .select('id')
        .single();
      if (insErr) throw insErr;
      contactId = inserted.id as string;
    }

    // Find owned number by To
    const { data: owned, error: ownErr } = await supabase
      .from('owned_numbers')
      .select('id')
      .eq('phone_e164', to)
      .maybeSingle();
    if (ownErr || !owned?.id) throw ownErr || new Error('owned number not configured');

    // Ensure conversation OPEN/SNOOZED
    const { data: convo } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('owned_number_id', owned.id)
      .in('status', ['OPEN', 'SNOOZED'])
      .maybeSingle();

    let conversationId = convo?.id as string | undefined;
    if (!conversationId) {
      const { data: created, error: createErr } = await supabase
        .from('conversations')
        .insert({ contact_id: contactId, owned_number_id: owned.id, status: 'OPEN', last_message_at: new Date().toISOString() })
        .select('id')
        .single();
      if (createErr) throw createErr;
      conversationId = created.id as string;
    }

    // Insert inbound message
    const { error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction: 'INBOUND',
        body: text || '',
        from_number_e164: from,
        to_number_e164: to,
        status: 'RECEIVED',
        received_at: new Date().toISOString(),
        message_sid: messageSid || null,
      });
    if (msgErr) throw msgErr;

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});



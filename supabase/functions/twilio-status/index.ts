// @ts-nocheck
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

async function verifyTwilioSignature(req: Request, bodyObj: Record<string, string>, rawBody: string): Promise<{ ok: boolean; provided?: string; url?: string; tried?: string[] }> {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const verifyEnabled = (Deno.env.get('TWILIO_VERIFY_SIGNATURE') ?? 'true') === 'true';
  if (!authToken || !verifyEnabled) return { ok: true };
  const signature = req.headers.get('X-Twilio-Signature') || '';

  // Build public URL (proxy-safe)
  const observed = new URL(req.url);
  const hdrProto = req.headers.get('x-forwarded-proto') || observed.protocol.replace(':','') || 'https';
  const hdrHost = req.headers.get('x-forwarded-host') || observed.host;
  let path = observed.pathname;
  if (!path.startsWith('/functions/v1/')) path = `/functions/v1${path}`;
  const override = Deno.env.get('TWILIO_PUBLIC_URL_STATUS') || Deno.env.get('TWILIO_PUBLIC_URL');
  const url = override || `${hdrProto}://${hdrHost}${path}`;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);

  const candidates: string[] = [];

  // Per Twilio: canonical string = URL + each POST parameter name and value concatenated, parameters sorted by name.
  const keys1 = Object.keys(bodyObj).sort();
  const data1 = url + keys1.map((k) => `${k}${bodyObj[k] ?? ''}`).join('');
  candidates.push(data1);

  // Raw form values (no decoding) sorted by decoded key names, concatenating key+rawValue
  const rawPairs = rawBody.split('&').map(p => p.split('='));
  const decodedForSort = rawPairs.map(([k, v]) => ({ key: decodeURIComponent(k || ''), rawV: (v ?? '') }));
  decodedForSort.sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const data2 = url + decodedForSort.map((p) => `${p.key}${p.rawV}`).join('');
  candidates.push(data2);

  // Raw values with '+' treated as space, concatenating key+value
  const data3 = url + decodedForSort.map((p) => `${p.key}${p.rawV.replace(/\+/g, ' ')}`).join('');
  candidates.push(data3);

  for (const data of candidates) {
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    if (timingSafeEqual(signature, expected)) {
      return { ok: true, provided: signature, url };
    }
  }
  return { ok: false, provided: signature, url, tried: candidates.map((d) => `len:${d.length}`) };
}

async function updateStatus(messageSid: string, status: string, errorCode?: string, errorMessage?: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const map: Record<string, string> = {
    queued: 'QUEUED',
    accepted: 'SENDING',
    sending: 'SENDING',
    sent: 'SENT',
    delivered: 'DELIVERED',
    undelivered: 'UNDELIVERED',
    failed: 'FAILED',
  };
  const dbStatus = map[status?.toLowerCase?.()] || 'SENT';
  const stampField = dbStatus === 'DELIVERED' ? 'delivered_at' : dbStatus === 'FAILED' ? null : null;

  const updates: any = { status: dbStatus, status_updated_at: new Date().toISOString() };
  if (stampField === 'delivered_at') updates.delivered_at = new Date().toISOString();
  if (errorCode) updates.error_code = Number(errorCode);
  if (errorMessage) updates.error_message = errorMessage;

  await supabase
    .from('messages')
    .update(updates)
    .eq('message_sid', messageSid);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const contentType = req.headers.get('content-type') || '';
    const raw = await req.text();
    const body = contentType.includes('application/x-www-form-urlencoded') ? parseFormEncoded(raw) : (raw ? JSON.parse(raw) : {});

    const sig = await verifyTwilioSignature(req, body as Record<string,string>, raw);
    if (!sig.ok) {
      console.log('Twilio status signature failed', { provided: sig.provided, url: sig.url, tried: sig.tried });
      return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const messageSid = body.MessageSid as string;
    const messageStatus = body.MessageStatus as string;
    const errorCode = body.ErrorCode as string | undefined;
    const errorMessage = body.ErrorMessage as string | undefined;
    if (!messageSid) {
      return new Response(JSON.stringify({ error: 'missing MessageSid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('[twilio-status] payload', { messageSid, messageStatus, errorCode, hasRaw: !!raw, ct: contentType });
    await updateStatus(messageSid, messageStatus, errorCode, errorMessage);
    console.log('[twilio-status] updated', { messageSid, to: messageStatus });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});



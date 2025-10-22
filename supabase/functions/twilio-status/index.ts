// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

function parseFormEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) obj[key] = value;
  return obj;
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

    const messageSid = body.MessageSid as string;
    const messageStatus = body.MessageStatus as string;
    const errorCode = body.ErrorCode as string | undefined;
    const errorMessage = body.ErrorMessage as string | undefined;
    if (!messageSid) {
      return new Response(JSON.stringify({ error: 'missing MessageSid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await updateStatus(messageSid, messageStatus, errorCode, errorMessage);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});



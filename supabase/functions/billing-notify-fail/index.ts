// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const { paymentId } = await req.json();
    if (!paymentId) return json({ error: 'paymentId required' }, 400);

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('id, student_id, session_id, amount_cents')
      .eq('id', paymentId)
      .maybeSingle();
    if (payErr || !payment) return json({ error: 'payment not found' }, 404);

    // Ensure contact for student and create conversation
    // Minimal: find a contact by student_id
    const { data: contactLink } = await supabase
      .from('contacts')
      .select('id, phone_e164')
      .eq('student_id', payment.student_id)
      .maybeSingle();
    if (!contactLink?.id || !contactLink.phone_e164) return json({ error: 'no contact/phone for student' }, 400);

    // Ensure an owned number exists
    const { data: owned } = await supabase
      .from('owned_numbers')
      .select('id')
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!owned?.id) return json({ error: 'no owned number configured' }, 400);

    // Find or create conversation
    const { data: existingConvo } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactLink.id)
      .eq('owned_number_id', owned.id)
      .maybeSingle();
    const convoId = existingConvo?.id || (await (async () => {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ contact_id: contactLink.id, owned_number_id: owned.id, status: 'OPEN' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    })());

    const body = `Payment failed for your session. Amount: $${(payment.amount_cents/100).toFixed(2)}. Please update your card details via the student portal.`;
    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({ conversation_id: convoId, body, direction: 'OUTGOING', status: 'QUEUED' })
      .select('id')
      .single();
    if (msgErr) throw msgErr;

    const url = new URL('/functions/v1/send-sms', supabaseUrl).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[notify-fail] send-sms error', t);
    }

    return json({ ok: true, messageId: msg.id });
  } catch (e: any) {
    console.error('[notify-fail] error', e?.message || e);
    return json({ error: 'notify_error' }, 500);
  }
});



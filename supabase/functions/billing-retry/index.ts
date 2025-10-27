// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (_req: Request) => {
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const backoffHours = [0, 6, 24];
    const now = Date.now();

    const { data: failed, error: failErr } = await supabase
      .from('payments')
      .select('id, amount_cents, currency, retry_count, last_retry_at, student_id, sessions_students_id')
      .eq('status', 'failed')
      .lt('retry_count', 3);
    if (failErr) throw failErr;

    let attempted = 0;
    for (const p of failed || []) {
      const last = p.last_retry_at ? new Date(p.last_retry_at).getTime() : 0;
      const waitHrs = backoffHours[p.retry_count] ?? 24;
      if (last && now - last < waitHrs * 3600 * 1000) continue;

      // Load billing
      const { data: bill } = await supabase
        .from('students_billing')
        .select('stripe_customer_id, default_payment_method_id')
        .eq('student_id', p.student_id)
        .maybeSingle();
      if (!bill?.stripe_customer_id || !bill?.default_payment_method_id) continue;

      try {
        const pi = await stripe.paymentIntents.create({
          amount: p.amount_cents,
          currency: (p.currency || 'AUD').toLowerCase(),
          customer: bill.stripe_customer_id,
          payment_method: bill.default_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: { type: 'retry', payment_id: p.id, sessions_students_id: p.sessions_students_id },
        }, { idempotencyKey: `retry_${p.id}_${p.retry_count + 1}` });

        const status = pi.status || 'processing';
        await supabase
          .from('payments')
          .update({ status, stripe_payment_intent_id: pi.id, last_retry_at: new Date().toISOString(), retry_count: p.retry_count + 1 })
          .eq('id', p.id);
        attempted++;
      } catch (e: any) {
        await supabase
          .from('payments')
          .update({ last_retry_at: new Date().toISOString(), retry_count: p.retry_count + 1, failure_message: String(e?.message || e) })
          .eq('id', p.id);
      }
    }

    return json({ ok: true, attempted });
  } catch (e: any) {
    console.error('[retry] error', e?.message || e);
    return json({ error: 'retry_error' }, 500);
  }
});



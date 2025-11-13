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

    // Query latest failed attempts (not all attempts)
    const { data: failedAttempts, error: failErr } = await supabase
      .from('payment_attempts')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: true });
    if (failErr) throw failErr;

    // Group by sessions_students_id to get latest attempt
    const attemptsBySession = new Map();
    for (const attempt of failedAttempts || []) {
      const existing = attemptsBySession.get(attempt.sessions_students_id);
      if (!existing || attempt.attempt_number > existing.attempt_number) {
        attemptsBySession.set(attempt.sessions_students_id, attempt);
      }
    }

    let attempted = 0;
    for (const [_, latestAttempt] of attemptsBySession) {
      // Check if max retries exceeded
      if (latestAttempt.attempt_number >= 3) continue;
      
      // Apply backoff
      const waitHrs = backoffHours[latestAttempt.attempt_number - 1] ?? 24;
      const elapsed = Date.now() - new Date(latestAttempt.created_at).getTime();
      if (elapsed < waitHrs * 3600 * 1000) continue;
      
      // Check if latest attempt has PI - verify status with Stripe first
      if (latestAttempt.stripe_payment_intent_id) {
        try {
          const pi = await stripe.paymentIntents.retrieve(latestAttempt.stripe_payment_intent_id);
          if (pi.status === 'succeeded') {
            // Webhook was delayed - update attempt to succeeded
            await supabase.from('payment_attempts')
              .update({ status: 'succeeded', charged_at: new Date().toISOString() })
              .eq('id', latestAttempt.id);
            continue;
          }
          if (pi.status === 'processing') {
            // Still processing - don't retry yet
            continue;
          }
        } catch (e) {
          console.error('[retry] Failed to verify PI status:', e);
        }
      }
      
      // Load billing info
      const { data: billing } = await supabase
        .from('students_billing')
        .select(`
          stripe_customer_id,
          payment_methods:student_payment_methods!inner(stripe_payment_method_id, card_country)
        `)
        .eq('student_id', latestAttempt.student_id)
        .eq('student_payment_methods.is_default', true)
        .maybeSingle();
      
      const defaultPM = billing?.payment_methods?.[0];
      if (!billing?.stripe_customer_id || !defaultPM?.stripe_payment_method_id) {
        // Create failed attempt for missing billing
        await supabase.from('payment_attempts').insert({
          sessions_students_id: latestAttempt.sessions_students_id,
          student_id: latestAttempt.student_id,
          session_id: latestAttempt.session_id,
          attempt_number: latestAttempt.attempt_number + 1,
          amount_cents: latestAttempt.amount_cents,
          currency: latestAttempt.currency,
          status: 'failed',
          failure_code: !billing?.stripe_customer_id ? 'no_billing_account' : 'no_payment_method',
          failure_message: !billing?.stripe_customer_id
            ? 'Student has no billing account'
            : 'Student has no payment method',
        });
        continue;
      }
      
      try {
        // Create new payment intent
        const pi = await stripe.paymentIntents.create({
          amount: latestAttempt.amount_cents,
          currency: (latestAttempt.currency || 'AUD').toLowerCase(),
          customer: billing.stripe_customer_id,
          payment_method: defaultPM.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: { 
            type: 'retry',
            original_attempt_id: latestAttempt.id,
            sessions_students_id: latestAttempt.sessions_students_id,
            attempt_number: latestAttempt.attempt_number + 1,
          },
        }, { 
          idempotencyKey: `retry_${latestAttempt.sessions_students_id}_${latestAttempt.attempt_number + 1}` 
        });
        
        // Create new attempt record
        const { data: newAttempt } = await supabase
          .from('payment_attempts')
          .insert({
            sessions_students_id: latestAttempt.sessions_students_id,
            student_id: latestAttempt.student_id,
            session_id: latestAttempt.session_id,
            attempt_number: latestAttempt.attempt_number + 1,
            amount_cents: latestAttempt.amount_cents,
            currency: latestAttempt.currency,
            stripe_payment_intent_id: pi.id,
            stripe_charge_id: pi.latest_charge as string | null,
            status: pi.status || 'processing',
          })
          .select()
          .single();
        
        attempted++;
      } catch (e: any) {
        const failureCode = e?.code 
          || e?.payment_intent?.last_payment_error?.code 
          || 'unknown_error';
        
        await supabase.from('payment_attempts').insert({
          sessions_students_id: latestAttempt.sessions_students_id,
          student_id: latestAttempt.student_id,
          session_id: latestAttempt.session_id,
          attempt_number: latestAttempt.attempt_number + 1,
          amount_cents: latestAttempt.amount_cents,
          currency: latestAttempt.currency,
          status: 'failed',
          failure_code: failureCode,
          failure_message: String(e?.message || e),
        });
      }
    }

    return json({ ok: true, attempted });
  } catch (e: any) {
    console.error('[retry] error', e?.message || e);
    return json({ error: 'retry_error' }, 500);
  }
});

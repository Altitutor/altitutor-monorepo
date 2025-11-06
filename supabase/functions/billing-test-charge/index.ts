// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    } 
  });
}

function grossUp(net: number, isInternational: boolean, percentDomestic: number, percentIntl: number, fixedCents: number) {
  const percent = isInternational ? percentIntl : percentDomestic;
  return Math.round((net + fixedCents) / (1 - percent));
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const { sessionsStudentsId } = await req.json();
    if (!sessionsStudentsId) return json({ error: 'sessionsStudentsId required' }, 400);

    // Load fee settings from DB
    const { data: settings, error: settingsErr } = await supabase
      .from('billing_settings')
      .select('setting_key, setting_value');
    if (settingsErr) throw settingsErr;
    
    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) settingsMap[s.setting_key] = s.setting_value;
    
    const FEE_PERCENT_DOM = Number(settingsMap.fee_percent_domestic || '0.0175');
    const FEE_PERCENT_INTL = Number(settingsMap.fee_percent_intl || '0.029');
    const FEE_FIXED_CENTS = Number(settingsMap.fee_fixed_cents || '30');
    const DOMESTIC_COUNTRY = (settingsMap.domestic_country || 'AU').toUpperCase();

    // Get sessions_students record with session and subject details
    const { data: ssRow, error: ssErr } = await supabase
      .from('sessions_students')
      .select('id, session_id, student_id, planned_absence')
      .eq('id', sessionsStudentsId)
      .single();
    if (ssErr || !ssRow) return json({ error: 'sessions_students record not found' }, 404);

    if (ssRow.planned_absence) {
      return json({ error: 'Cannot charge - student has planned absence' }, 400);
    }

    // Check for existing payment
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('sessions_students_id', ssRow.id)
      .maybeSingle();
    if (existing?.id) {
      return json({ error: 'Payment already exists', paymentId: existing.id, status: existing.status }, 400);
    }

    // Get session details
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, start_at, subject_id')
      .eq('id', ssRow.session_id)
      .single();
    if (sessionErr || !session) return json({ error: 'Session not found' }, 404);

    // Get subject with pricing
    const { data: subject, error: subjErr } = await supabase
      .from('subjects')
      .select('id, billing_type, session_fee_cents, currency')
      .eq('id', session.subject_id)
      .single();
    if (subjErr || !subject) return json({ error: 'Subject not found' }, 404);

    // Resolve price (check for active subsidy)
    let netCents = subject.session_fee_cents || 0;
    const { data: subsidies } = await supabase
      .from('student_subsidies')
      .select('price_cents, effective_from, effective_until')
      .eq('student_id', ssRow.student_id)
      .eq('subject_id', session.subject_id)
      .eq('billing_type', subject.billing_type);
    
    const activeSub = (subsidies || []).find((s: any) => 
      (!s.effective_until || new Date(s.effective_until) > new Date())
    );
    if (activeSub) netCents = activeSub.price_cents;
    
    if (netCents <= 0) {
      return json({ error: 'No charge required - session fee is $0' }, 400);
    }

    // Get student billing info
    const { data: billing, error: billErr } = await supabase
      .from('students_billing')
      .select('student_id, stripe_customer_id, default_payment_method_id, card_country')
      .eq('student_id', ssRow.student_id)
      .maybeSingle();
    
    if (billErr || !billing?.stripe_customer_id || !billing?.default_payment_method_id) {
      return json({ error: 'Student has no payment method on file' }, 400);
    }

    // Calculate gross amount with fees
    const isIntl = (billing.card_country && billing.card_country.toUpperCase() !== DOMESTIC_COUNTRY);
    const grossCents = grossUp(netCents, !!isIntl, FEE_PERCENT_DOM, FEE_PERCENT_INTL, FEE_FIXED_CENTS);

    // Get receipt email (prefer parent, fallback to student)
    const { data: parentsJoin } = await supabase
      .from('parents_students')
      .select('parent:parents(email)')
      .eq('student_id', ssRow.student_id)
      .limit(1);
    const parentEmail = (parentsJoin?.[0] as any)?.parent?.email;
    
    const { data: student } = await supabase
      .from('students')
      .select('email')
      .eq('id', ssRow.student_id)
      .single();
    const receiptEmail = parentEmail || student?.email;

    // Create pending payment record
    const { data: payment, error: insErr } = await supabase
      .from('payments')
      .insert({
        sessions_students_id: ssRow.id,
        student_id: ssRow.student_id,
        session_id: ssRow.session_id,
        amount_cents: grossCents,
        currency: subject.currency || 'AUD',
        status: 'pending',
      })
      .select('*')
      .single();
    
    if (insErr) {
      console.error('[test-charge] insert payment failed', insErr);
      return json({ error: 'Failed to create payment record' }, 500);
    }

    // Create Stripe PaymentIntent
    try {
      const pi = await stripe.paymentIntents.create({
        amount: grossCents,
        currency: (subject.currency || 'AUD').toLowerCase(),
        customer: billing.stripe_customer_id,
        payment_method: billing.default_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Test charge - Session on ${session.start_at}`,
        receipt_email: receiptEmail,
        metadata: {
          type: 'session_charge',
          student_id: ssRow.student_id,
          session_id: ssRow.session_id,
          sessions_students_id: ssRow.id,
          test_charge: 'true',
        },
      }, { idempotencyKey: payment.id });

      const latestChargeId = pi.latest_charge as string | undefined;
      const { error: updErr } = await supabase
        .from('payments')
        .update({ 
          status: pi.status || 'processing', 
          stripe_payment_intent_id: pi.id, 
          stripe_charge_id: latestChargeId || null 
        })
        .eq('id', payment.id);
      
      if (updErr) console.error('[test-charge] update payment after PI', updErr);

      return json({ 
        ok: true, 
        paymentId: payment.id, 
        paymentIntentId: pi.id,
        status: pi.status,
        amount: grossCents,
        currency: subject.currency || 'AUD'
      });
    } catch (e: any) {
      console.error('[test-charge] PI create failed', e?.message || e);
      await supabase
        .from('payments')
        .update({ status: 'failed', failure_message: String(e?.message || e) })
        .eq('id', payment.id);
      
      return json({ 
        error: 'Stripe payment failed', 
        message: e?.message || String(e),
        paymentId: payment.id 
      }, 500);
    }
  } catch (e: any) {
    console.error('[test-charge] error', e?.message || e);
    return json({ error: 'test_charge_error', message: String(e?.message || e) }, 500);
  }
});



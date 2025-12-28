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

function startEndForTomorrow(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0);
  const end = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
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
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  
  // Check if using test or live Stripe keys
  const isStripeTestKey = STRIPE_SECRET_KEY.startsWith('sk_test_');
  const isStripeLiveKey = STRIPE_SECRET_KEY.startsWith('sk_live_');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Parse request body for test mode and date override
  let testMode = false;
  let dateOverride: string | null = null;
  let isServiceRole = false;
  
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');
    
    // Check if this is a service role request (cron job or direct service call)
    if (apiKey === supabaseServiceKey || authHeader?.includes(supabaseServiceKey)) {
      isServiceRole = true;
    }
    
    // Parse request body if it exists (only for POST requests)
    if (req.method === 'POST') {
      try {
        const bodyText = await req.text();
        if (bodyText) {
          const body = JSON.parse(bodyText);
          testMode = body.testMode === true;
          dateOverride = body.date || null;
        }
      } catch {
        // Body parsing failed, continue with defaults
      }
    }
    
    // Security check: Test mode can only be triggered by authenticated admin staff
    if (testMode && !isServiceRole) {
      // Create a client with the user's auth token to verify admin status
      const userAuthHeader = authHeader?.replace('Bearer ', '');
      if (!userAuthHeader) {
        return json({ error: 'Unauthorized: Authentication required for test mode' }, 401);
      }
      
      const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${userAuthHeader}` } }
      });
      
      // Verify user is ADMINSTAFF
      const { data: { user } } = await userSupabase.auth.getUser();
      if (!user) {
        return json({ error: 'Unauthorized: Invalid authentication' }, 401);
      }
      
      const { data: staff } = await userSupabase
        .from('staff')
        .select('role, status')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!staff || staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
        return json({ error: 'Unauthorized: Admin access required for test mode' }, 403);
      }
    }
    
    // Production mode: Only allow service role (cron jobs)
    if (!testMode && !isServiceRole) {
      return json({ error: 'Unauthorized: Production billing can only be triggered by cron jobs' }, 403);
    }
    
    // Safety check: Prevent test mode from using live Stripe keys
    if (testMode && isStripeLiveKey) {
      return json({ 
        error: 'Safety check failed: Test mode cannot use live Stripe keys',
        message: 'Test mode requires Stripe test keys (sk_test_...). Live keys (sk_live_...) are not allowed in test mode to prevent accidental charges.'
      }, 400);
    }
    
  } catch (authErr: any) {
    return json({ error: 'Authentication error', message: authErr?.message }, 401);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
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

    // Determine date range: use override if provided, otherwise tomorrow (production) or today (test)
    let targetDate: Date;
    if (dateOverride) {
      targetDate = new Date(dateOverride);
    } else if (testMode) {
      // In test mode, process today's sessions by default
      targetDate = new Date();
    } else {
      // Production mode: process tomorrow's sessions
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const { startIso, endIso } = (() => {
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      return { startIso: start.toISOString(), endIso: end.toISOString() };
    })();

    // Find sessions for target date
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, start_at, subject_id')
      .gte('start_at', startIso)
      .lte('start_at', endIso);
    if (sessErr) throw sessErr;

    if (!sessions?.length) {
      return json({ 
        ok: true, 
        processed: 0, 
        testMode,
        dateRange: { start: startIso, end: endIso },
        message: `No sessions found for ${testMode ? 'today' : 'tomorrow'}`
      });
    }

    // Load attending students and subject pricing
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: ssRows, error: ssErr } = await supabase
      .from('sessions_students')
      .select('id, session_id, student_id, planned_absence')
      .in('session_id', sessionIds);
    if (ssErr) throw ssErr;

    const subjectIds = Array.from(new Set(sessions.map((s: any) => s.subject_id).filter(Boolean)));
    const { data: subjects, error: subjErr } = await supabase
      .from('subjects')
      .select('id, billing_type, session_fee_cents, currency')
      .in('id', subjectIds);
    if (subjErr) throw subjErr;
    const subjectById: Record<string, any> = {};
    for (const sub of subjects || []) subjectById[sub.id] = sub;

    // Get billing info with default payment method using optimized view (single query with JOIN)
    const { data: billingRows, error: billErr } = await supabase
      .from('vadmin_billing_with_payment_methods')
      .select('student_id, stripe_customer_id, stripe_payment_method_id, card_country');
    if (billErr) throw billErr;
    
    // Build map of student_id -> billing info with default payment method
    const billingByStudent: Record<string, any> = {};
    for (const b of billingRows || []) {
      billingByStudent[b.student_id] = {
        student_id: b.student_id,
        stripe_customer_id: b.stripe_customer_id,
        payment_methods: b.stripe_payment_method_id ? [{
          stripe_payment_method_id: b.stripe_payment_method_id,
          card_country: b.card_country
        }] : []
      };
    }

    // Parent emails
    const { data: parentsJoin } = await supabase
      .from('parents_students')
      .select('student_id, parent:parents(id, email)');
    const parentEmailByStudent: Record<string, string | undefined> = {};
    for (const row of parentsJoin || []) {
      const email = (row as any).parent?.email as string | undefined;
      if (email && !parentEmailByStudent[row.student_id]) parentEmailByStudent[row.student_id] = email;
    }
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, email');
    if (stErr) throw stErr;
    const studentEmailById: Record<string, string | undefined> = {};
    for (const s of students || []) studentEmailById[s.id] = s.email || undefined;

    // Subsidies (active)
    const { data: subsidies, error: subErr } = await supabase
      .from('student_subsidies')
      .select('student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until');
    if (subErr) throw subErr;

    const paymentsCreated: string[] = [];

    for (const row of ssRows || []) {
      if (row.planned_absence) continue;
      const session = sessions.find((s: any) => s.id === row.session_id);
      if (!session) continue;
      const subject = subjectById[session.subject_id];
      if (!subject) continue;

      // Resolve price (subsidy override if active)
      let netCents = subject.session_fee_cents || 0;
      const activeSub = (subsidies || []).find((s: any) =>
        s.student_id === row.student_id && s.subject_id === session.subject_id && s.billing_type === subject.billing_type && (!s.effective_until || new Date(s.effective_until) > new Date())
      );
      if (activeSub) netCents = activeSub.price_cents;
      
      // Track zero-amount sessions (audit trail for manual review)
      if (netCents <= 0) {
        // Check if already tracked
        const { data: existingSkipped } = await supabase
          .from('payment_attempts')
          .select('id')
          .eq('sessions_students_id', row.id)
          .maybeSingle();
        if (!existingSkipped) {
          await supabase.from('payment_attempts').insert({
            sessions_students_id: row.id,
            student_id: row.student_id,
            session_id: row.session_id,
            attempt_number: 1,
            amount_cents: 0,
            currency: subject.currency || 'AUD',
            status: 'skipped',
            failure_code: 'zero_amount',
            failure_message: netCents === 0 
              ? 'Session has zero fee (subject fee is $0.00 or fully subsidized)'
              : `Session has negative fee: ${netCents} cents (subsidy exceeds subject fee)`,
          });
        }
        continue;
      }

      const billing = billingByStudent[row.student_id];
      const defaultPM = billing?.payment_methods?.[0];
      
      const isIntl = (defaultPM?.card_country && defaultPM.card_country.toUpperCase() !== DOMESTIC_COUNTRY);
      const grossCents = grossUp(netCents, !!isIntl, FEE_PERCENT_DOM, FEE_PERCENT_INTL, FEE_FIXED_CENTS);

      // Check for existing payment attempts (skip if already processed)
      const { data: existingAttempts } = await supabase
        .from('payment_attempts')
        .select('attempt_number')
        .eq('sessions_students_id', row.id)
        .order('attempt_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingAttempts) continue;  // Already has attempts

      // Track skipped obligations (audit trail for manual follow-up)
      if (!billing?.stripe_customer_id || !defaultPM?.stripe_payment_method_id) {
        await supabase.from('payment_attempts').insert({
          sessions_students_id: row.id,
          student_id: row.student_id,
          session_id: row.session_id,
          attempt_number: 1,
          amount_cents: grossCents,
          currency: subject.currency || 'AUD',
          status: 'failed',
          failure_code: !billing?.stripe_customer_id 
            ? 'no_billing_account' 
            : 'no_payment_method',
          failure_message: !billing?.stripe_customer_id
            ? 'Student has no billing account configured'
            : 'Student has no default payment method',
        });
        continue;
      }

      // Create pending payment attempt record first (id used as idempotency key)
      const { data: attempt, error: insErr } = await supabase
        .from('payment_attempts')
        .insert({
          sessions_students_id: row.id,
          student_id: row.student_id,
          session_id: row.session_id,
          attempt_number: 1,
          amount_cents: grossCents,
          currency: subject.currency || 'AUD',
          status: 'pending',
        })
        .select('*')
        .single();
      if (insErr) {
        console.error('[runner] insert payment attempt failed', insErr);
        continue;
      }

      try {
        // Test mode: Only charge if using Stripe test keys (sk_test_...)
        // Production mode: Charge using configured keys (should be sk_live_...)
        // Safety: Test mode with live keys is blocked above
        const receiptEmail = parentEmailByStudent[row.student_id] || studentEmailById[row.student_id];
        const pi = await stripe.paymentIntents.create({
          amount: grossCents,
          currency: 'aud',
          customer: billing.stripe_customer_id,
          payment_method: defaultPM.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: testMode 
            ? `TEST MODE - Session charge for ${session.start_at}` 
            : `Session charge for ${session.start_at}`,
          receipt_email: receiptEmail,
          metadata: {
            type: 'session_charge',
            student_id: row.student_id,
            session_id: row.session_id,
            sessions_students_id: row.id,
            attempt_number: 1,
            test_mode: testMode ? 'true' : 'false',
            stripe_key_type: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
          },
        }, { idempotencyKey: attempt.id });

        const latestChargeId = pi.latest_charge as string | undefined;
        const { error: updErr } = await supabase
          .from('payment_attempts')
          .update({ status: pi.status || 'processing', stripe_payment_intent_id: pi.id, stripe_charge_id: latestChargeId || null })
          .eq('id', attempt.id);
        if (updErr) console.error('[runner] update payment attempt after PI', updErr);
        paymentsCreated.push(attempt.id);
      } catch (e: any) {
        console.error('[runner] payment processing failed', e?.message || e);
        
        // Extract failure_code from Stripe error
        const failureCode = e?.code 
          || e?.payment_intent?.last_payment_error?.code 
          || 'unknown_error';
        const failureMessage = e?.message || String(e);
        
        await supabase
          .from('payment_attempts')
          .update({ 
            status: 'failed', 
            failure_code: failureCode,
            failure_message: failureMessage 
          })
          .eq('id', attempt.id);
      }
    }

    return json({ 
      ok: true, 
      created: paymentsCreated.length,
      testMode,
      stripeKeyType: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
      dateRange: { start: startIso, end: endIso },
      message: testMode 
        ? `Test mode: Created ${paymentsCreated.length} payment records${isStripeTestKey ? ' (using Stripe test keys - safe for testing)' : ''}` 
        : `Created ${paymentsCreated.length} payment records${isStripeLiveKey ? ' (using Stripe live keys - production)' : ''}`
    });
  } catch (e: any) {
    console.error('[runner] error', e?.message || e);
    return json({ error: 'runner_error', message: e?.message || String(e), testMode }, 500);
  }
});

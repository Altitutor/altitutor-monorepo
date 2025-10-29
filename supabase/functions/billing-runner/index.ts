// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { status, headers: { 'Content-Type': 'application/json' } });
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

Deno.serve(async (_req: Request) => {
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

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

    const { startIso, endIso } = startEndForTomorrow(new Date());

    // Find sessions for tomorrow
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, start_at, subject_id')
      .gte('start_at', startIso)
      .lte('start_at', endIso);
    if (sessErr) throw sessErr;

    if (!sessions?.length) return json({ ok: true, processed: 0 });

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

    const { data: billingRows, error: billErr } = await supabase
      .from('students_billing')
      .select('student_id, stripe_customer_id, default_payment_method_id, card_country');
    if (billErr) throw billErr;
    const billingByStudent: Record<string, any> = {};
    for (const b of billingRows || []) billingByStudent[b.student_id] = b;

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
      if (netCents <= 0) continue;

      const billing = billingByStudent[row.student_id];
      if (!billing?.stripe_customer_id || !billing?.default_payment_method_id) continue;

      const isIntl = (billing.card_country && billing.card_country.toUpperCase() !== DOMESTIC_COUNTRY);
      const grossCents = grossUp(netCents, !!isIntl, FEE_PERCENT_DOM, FEE_PERCENT_INTL, FEE_FIXED_CENTS);

      // Ensure no duplicate payment exists
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('sessions_students_id', row.id)
        .maybeSingle();
      if (existing?.id) continue;

      // Create pending payment record first (id used as idempotency key)
      const { data: pay, error: insErr } = await supabase
        .from('payments')
        .insert({
          sessions_students_id: row.id,
          student_id: row.student_id,
          session_id: row.session_id,
          amount_cents: grossCents,
          currency: subject.currency || 'AUD',
          status: 'pending',
        })
        .select('*')
        .single();
      if (insErr) {
        console.error('[runner] insert payment failed', insErr);
        continue;
      }

      try {
        const receiptEmail = parentEmailByStudent[row.student_id] || studentEmailById[row.student_id];
        const pi = await stripe.paymentIntents.create({
          amount: grossCents,
          currency: 'aud',
          customer: billing.stripe_customer_id,
          payment_method: billing.default_payment_method_id,
          off_session: true,
          confirm: true,
          description: `Session charge for ${session.start_at}`,
          receipt_email: receiptEmail,
          metadata: {
            type: 'session_charge',
            student_id: row.student_id,
            session_id: row.session_id,
            sessions_students_id: row.id,
          },
        }, { idempotencyKey: pay.id });

        const latestChargeId = pi.latest_charge as string | undefined;
        const { error: updErr } = await supabase
          .from('payments')
          .update({ status: pi.status || 'processing', stripe_payment_intent_id: pi.id, stripe_charge_id: latestChargeId || null })
          .eq('id', pay.id);
        if (updErr) console.error('[runner] update payment after PI', updErr);
        paymentsCreated.push(pay.id);
      } catch (e: any) {
        console.error('[runner] PI create failed', e?.message || e);
        await supabase
          .from('payments')
          .update({ status: 'failed', failure_message: String(e?.message || e) })
          .eq('id', pay.id);
      }
    }

    return json({ ok: true, created: paymentsCreated.length });
  } catch (e: any) {
    console.error('[runner] error', e?.message || e);
    return json({ error: 'runner_error' }, 500);
  }
});

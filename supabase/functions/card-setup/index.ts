// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

type SetupRequest = {
  studentId: string;
  email?: string | null;
  name?: string | null;
};

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin, Access-Control-Request-Headers',
    },
  });
}

function corsPreflight(req: Request) {
  const acrh = req.headers.get('access-control-request-headers') || '';
  const requestHeaders = (acrh || 'authorization, x-client-info, apikey, content-type, x-supabase-authorization').toLowerCase();
  return new Response('ok', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': requestHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin, Access-Control-Request-Headers',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const body: SetupRequest = await req.json();
    const { studentId, email, name } = body || {};
    if (!studentId) return json({ error: 'studentId required' }, 400);

    // Load student for default name/email if not provided
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('id', studentId)
      .maybeSingle();
    if (stuErr) throw stuErr;
    if (!student) return json({ error: 'student not found' }, 404);

    const fullName = name || `${student.first_name || ''} ${student.last_name || ''}`.trim();
    const targetEmail = email || student.email || undefined;

    // Ensure students_billing row + Stripe customer
    let stripeCustomerId: string | null = null;
    const { data: billingRow, error: billErr } = await supabase
      .from('students_billing')
      .select('student_id, stripe_customer_id')
      .eq('student_id', studentId)
      .maybeSingle();
    if (billErr) throw billErr;

    if (billingRow?.stripe_customer_id) {
      stripeCustomerId = billingRow.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        name: fullName || undefined,
        email: targetEmail,
        metadata: { student_id: studentId },
      });
      stripeCustomerId = customer.id;
      const { error: upErr } = await supabase
        .from('students_billing')
        .upsert({ student_id: studentId, stripe_customer_id: stripeCustomerId }, { onConflict: 'student_id' });
      if (upErr) throw upErr;
    }

    // Create a small verification PaymentIntent to collect card + save for off-session
    const amountCents = 50; // $0.50
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'aud',
      customer: stripeCustomerId!,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      description: 'Card verification',
      metadata: { type: 'verification', student_id: studentId },
    });

    return json({ client_secret: pi.client_secret, payment_intent_id: pi.id });
  } catch (e: any) {
    console.error('[card-setup] Error', e?.message || e);
    return json({ error: e?.message || 'Unknown error' }, 500);
  }
});



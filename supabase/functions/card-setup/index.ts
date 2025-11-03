// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const { studentId, email, name } = await req.json();
    if (!studentId) return json({ error: 'studentId required' }, 400);

    // Check if student exists
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('id', studentId)
      .single();
    
    if (studentErr || !student) {
      return json({ error: 'Student not found' }, 404);
    }

    // Get or create students_billing record
    const { data: billing, error: billingErr } = await supabase
      .from('students_billing')
      .select('student_id, stripe_customer_id')
      .eq('student_id', studentId)
      .maybeSingle();

    let customerId: string;

    if (billing?.stripe_customer_id) {
      // Customer already exists
      customerId = billing.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customerEmail = email || student.email;
      const customerName = name || `${student.first_name} ${student.last_name}`;
      
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          student_id: studentId,
        },
      });
      customerId = customer.id;

      // Insert or update students_billing record
      if (billing) {
        const { error: updateErr } = await supabase
          .from('students_billing')
          .update({ stripe_customer_id: customerId })
          .eq('student_id', studentId);
        
        if (updateErr) {
          console.error('[card-setup] Failed to update billing record', updateErr);
          return json({ error: 'Failed to update billing record' }, 500);
        }
      } else {
        const { error: insertErr } = await supabase
          .from('students_billing')
          .insert({ student_id: studentId, stripe_customer_id: customerId });
        
        if (insertErr) {
          console.error('[card-setup] Failed to create billing record', insertErr);
          return json({ error: 'Failed to create billing record' }, 500);
        }
      }
    }

    // Create a verification PaymentIntent for $0.50 AUD
    // This will be refunded automatically by the webhook when it succeeds
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 50, // $0.50 in cents
      currency: 'aud',
      customer: customerId,
      setup_future_usage: 'off_session',
      description: 'Card verification - will be refunded',
      metadata: {
        type: 'verification',
        student_id: studentId,
      },
    });

    return json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (e: any) {
    console.error('[card-setup] error', e?.message || e);
    return json({ 
      error: 'card_setup_error', 
      message: String(e?.message || e) 
    }, 500);
  }
});



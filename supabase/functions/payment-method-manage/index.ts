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
    },
  });
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
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  // Create client with user's JWT (from Authorization header)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });

  try {
    // Verify user is authenticated and get student_id
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError || !student) {
      return json({ error: 'Student not found' }, 404);
    }

    const { action, paymentMethodId } = await req.json();
    
    if (!action || !paymentMethodId) {
      return json({ error: 'Missing action or paymentMethodId' }, 400);
    }

    // Verify the payment method belongs to this student
    const { data: paymentMethod, error: pmError } = await supabase
      .from('student_payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .eq('student_id', student.id)
      .maybeSingle();

    if (pmError || !paymentMethod) {
      return json({ error: 'Payment method not found or unauthorized' }, 404);
    }

    if (action === 'set_default') {
      // Unset all other default payment methods for this student
      await supabase
        .from('student_payment_methods')
        .update({ is_default: false })
        .eq('student_id', student.id);

      // Set this one as default
      const { error: updateError } = await supabase
        .from('student_payment_methods')
        .update({ is_default: true })
        .eq('id', paymentMethodId)
        .eq('student_id', student.id);

      if (updateError) {
        console.error('[payment-method-manage] Error setting default:', updateError);
        return json({ error: 'Failed to set default payment method' }, 500);
      }

      return json({ success: true, message: 'Default payment method updated' });

    } else if (action === 'delete') {
      // Prevent deletion of the default payment method
      if (paymentMethod.is_default) {
        // Check if there are other payment methods
        const { data: otherMethods, error: countError } = await supabase
          .from('student_payment_methods')
          .select('id')
          .eq('student_id', student.id)
          .neq('id', paymentMethodId);

        if (countError) {
          return json({ error: 'Failed to check other payment methods' }, 500);
        }

        if (!otherMethods || otherMethods.length === 0) {
          return json({ error: 'Cannot delete the only payment method. Please add another payment method first.' }, 400);
        }

        return json({ error: 'Cannot delete default payment method. Please set another payment method as default first.' }, 400);
      }

      // Get customer ID for detaching from Stripe
      const { data: billing, error: billingError } = await supabase
        .from('students_billing')
        .select('stripe_customer_id')
        .eq('student_id', student.id)
        .maybeSingle();

      if (billingError || !billing) {
        return json({ error: 'Billing record not found' }, 404);
      }

      // Detach payment method from Stripe customer
      try {
        await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);
      } catch (stripeError: any) {
        console.error('[payment-method-manage] Stripe detach error:', stripeError?.message);
        // Continue even if Stripe detach fails - the webhook might have already handled it
      }

      // Delete from database (webhook will also try, but that's idempotent)
      const { error: deleteError } = await supabase
        .from('student_payment_methods')
        .delete()
        .eq('id', paymentMethodId)
        .eq('student_id', student.id);

      if (deleteError) {
        console.error('[payment-method-manage] Error deleting payment method:', deleteError);
        return json({ error: 'Failed to delete payment method' }, 500);
      }

      return json({ success: true, message: 'Payment method deleted' });

    } else {
      return json({ error: 'Invalid action. Use "set_default" or "delete"' }, 400);
    }

  } catch (e: any) {
    console.error('[payment-method-manage] error', e?.message || e);
    return json({ 
      error: 'payment_method_manage_error', 
      message: String(e?.message || e) 
    }, 500);
  }
});


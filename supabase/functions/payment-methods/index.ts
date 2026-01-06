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
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Create service role client for database operations (bypasses RLS)
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // Parse body first to check if this is a registration flow
  const body = await req.json();
  const { action, studentId, paymentMethodId, email, name, registrationToken } = body;

  // Check if this is a registration flow (no auth required)
  const isRegistrationFlow = !!registrationToken;

  let authenticatedStudentId: string | null = null;
  let isAdminStaff = false;

  if (!isRegistrationFlow) {
    // Normal flow: require authentication
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is admin staff
    const { data: staff } = await supabaseService
      .from('staff')
      .select('role, status')
      .eq('user_id', user.id)
      .maybeSingle();
    
    isAdminStaff = staff && staff.role === 'ADMINSTAFF' && staff.status === 'ACTIVE';

    // Get student record for non-admin users
    if (!isAdminStaff) {
      const { data: student, error: studentError } = await supabaseService
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentError || !student) {
        return json({ error: 'Student not found' }, 404);
      }
      authenticatedStudentId = student.id;
    }
  } else {
    // Registration flow: validate token instead of auth
    if (!registrationToken) {
      return json({ error: 'Registration token required' }, 400);
    }

    // Validate token and get student (same validation as /api/register/validate)
    const { data: student, error: studentError } = await supabaseService
      .from('students')
      .select('id, status, user_id')
      .eq('invite_token', registrationToken)
      .maybeSingle();

    if (studentError || !student) {
      return json({ error: 'Invalid or expired registration token' }, 404);
    }

    // Security check: prevent reuse of token for already registered students
    if (student.user_id && student.status === 'ACTIVE') {
      return json({ error: 'Student already registered' }, 400);
    }

    authenticatedStudentId = student.id;
    
    // Security: Only allow specific actions for registration flow
    if (action !== 'create_setup_intent' && action !== 'verify_payment_method') {
      return json({ error: 'Action not allowed for registration flow' }, 403);
    }
  }

  try {

    if (!action) {
      return json({ error: 'Missing action parameter' }, 400);
    }

    // Determine target student ID
    // Admin staff can specify studentId, students can only use their own
    const targetStudentId = isAdminStaff 
      ? (studentId || authenticatedStudentId)
      : authenticatedStudentId;

    if (!targetStudentId) {
      return json({ error: 'Student ID required' }, 400);
    }

    // Verify student exists
    const { data: targetStudent, error: targetStudentError } = await supabaseService
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('id', targetStudentId)
      .maybeSingle();

    if (targetStudentError || !targetStudent) {
      return json({ error: 'Student not found' }, 404);
    }

    // Handle different actions
    if (action === 'create_setup_intent') {
      // Get or create students_billing record
      const { data: billing, error: billingErr } = await supabaseService
        .from('students_billing')
        .select('student_id, stripe_customer_id')
        .eq('student_id', targetStudentId)
        .maybeSingle();

      let customerId: string;

      if (billing?.stripe_customer_id) {
        // Customer already exists
        customerId = billing.stripe_customer_id;
      } else {
        // Create new Stripe customer
        const customerEmail = email || targetStudent.email;
        const customerName = name || `${targetStudent.first_name} ${targetStudent.last_name}`;
        
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            student_id: targetStudentId,
          },
        });
        customerId = customer.id;

        // Insert or update students_billing record
        if (billing) {
          const { error: updateErr } = await supabaseService
            .from('students_billing')
            .update({ stripe_customer_id: customerId })
            .eq('student_id', targetStudentId);
          
          if (updateErr) {
            console.error('[payment-methods] Failed to update billing record', updateErr);
            return json({ error: 'Failed to update billing record' }, 500);
          }
        } else {
          const { error: insertErr } = await supabaseService
            .from('students_billing')
            .insert({ student_id: targetStudentId, stripe_customer_id: customerId });
          
          if (insertErr) {
            console.error('[payment-methods] Failed to create billing record', insertErr);
            return json({ error: 'Failed to create billing record' }, 500);
          }
        }
      }

      // Create a SetupIntent for card verification (no charge)
      // This is Stripe's recommended way to save payment methods
      const setupIntentMetadata: Record<string, string> = {
        student_id: targetStudentId,
      };
      
      // Add registration token to metadata if this is a registration flow
      if (isRegistrationFlow && registrationToken) {
        setupIntentMetadata.registration_token = registrationToken;
      }
      
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: setupIntentMetadata,
      });

      return json({
        client_secret: setupIntent.client_secret,
        setup_intent_id: setupIntent.id,
      });

    } else if (action === 'set_default') {
      if (!paymentMethodId) {
        return json({ error: 'paymentMethodId required for set_default action' }, 400);
      }

      // Verify the payment method belongs to the target student
      const { data: paymentMethod, error: pmError } = await supabaseService
        .from('student_payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .eq('student_id', targetStudentId)
        .maybeSingle();

      if (pmError || !paymentMethod) {
        return json({ error: 'Payment method not found or unauthorized' }, 404);
      }

      // Unset all other default payment methods for this student
      await supabaseService
        .from('student_payment_methods')
        .update({ is_default: false })
        .eq('student_id', targetStudentId);

      // Set this one as default
      const { error: updateError } = await supabaseService
        .from('student_payment_methods')
        .update({ is_default: true })
        .eq('id', paymentMethodId)
        .eq('student_id', targetStudentId);

      if (updateError) {
        console.error('[payment-methods] Error setting default:', updateError);
        return json({ error: 'Failed to set default payment method' }, 500);
      }

      // Update Stripe's default payment method
      const { data: billing, error: billingError } = await supabaseService
        .from('students_billing')
        .select('stripe_customer_id')
        .eq('student_id', targetStudentId)
        .maybeSingle();

      if (billing?.stripe_customer_id) {
        try {
          await stripe.customers.update(billing.stripe_customer_id, {
            invoice_settings: {
              default_payment_method: paymentMethod.stripe_payment_method_id,
            },
          });
        } catch (stripeError: any) {
          console.error('[payment-methods] Failed to update Stripe default payment method:', stripeError?.message);
          // Don't fail the request - DB update succeeded, webhook can sync later
        }
      }

      return json({ success: true, message: 'Default payment method updated' });

    } else if (action === 'delete') {
      if (!paymentMethodId) {
        return json({ error: 'paymentMethodId required for delete action' }, 400);
      }

      // Verify the payment method belongs to the target student
      const { data: paymentMethod, error: pmError } = await supabaseService
        .from('student_payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .eq('student_id', targetStudentId)
        .maybeSingle();

      if (pmError || !paymentMethod) {
        return json({ error: 'Payment method not found or unauthorized' }, 404);
      }

      // Prevent deletion of the default payment method
      if (paymentMethod.is_default) {
        // Check if there are other payment methods
        const { data: otherMethods, error: countError } = await supabaseService
          .from('student_payment_methods')
          .select('id')
          .eq('student_id', targetStudentId)
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
      const { data: billing, error: billingError } = await supabaseService
        .from('students_billing')
        .select('stripe_customer_id')
        .eq('student_id', targetStudentId)
        .maybeSingle();

      if (billingError || !billing) {
        return json({ error: 'Billing record not found' }, 404);
      }

      // Detach payment method from Stripe customer
      try {
        await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);
      } catch (stripeError: any) {
        console.error('[payment-methods] Stripe detach error:', stripeError?.message);
        // Continue even if Stripe detach fails - the webhook might have already handled it
      }

      // Delete from database (webhook will also try, but that's idempotent)
      const { error: deleteError } = await supabaseService
        .from('student_payment_methods')
        .delete()
        .eq('id', paymentMethodId)
        .eq('student_id', targetStudentId);

      if (deleteError) {
        console.error('[payment-methods] Error deleting payment method:', deleteError);
        return json({ error: 'Failed to delete payment method' }, 500);
      }

      return json({ success: true, message: 'Payment method deleted' });

    } else if (action === 'verify_payment_method') {
      // Verify that student has at least one payment method
      const { data: paymentMethods, error: pmError } = await supabaseService
        .from('student_payment_methods')
        .select('id')
        .eq('student_id', targetStudentId)
        .limit(1);

      if (pmError) {
        return json({ error: 'Failed to verify payment method' }, 500);
      }

      if (!paymentMethods || paymentMethods.length === 0) {
        return json({ verified: false, error: 'No payment method found' }, 400);
      }

      return json({
        verified: true,
        message: 'Payment method verified',
      });

    } else {
      return json({ error: 'Invalid action. Use "create_setup_intent", "set_default", "delete", or "verify_payment_method"' }, 400);
    }

  } catch (e: any) {
    console.error('[payment-methods] error', e?.message || e);
    return json({ 
      error: 'payment_methods_error', 
      message: String(e?.message || e) 
    }, 500);
  }
});


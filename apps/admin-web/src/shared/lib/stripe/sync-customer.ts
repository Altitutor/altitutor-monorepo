import Stripe from 'stripe';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export async function syncStudentToStripeCustomer(
  studentId: string
): Promise<void> {
  // Get Stripe secret key
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.warn('[sync-customer] Stripe not configured, skipping sync');
    return;
  }
  
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });
  
  if (!supabaseAdmin) {
    console.warn('[sync-customer] Supabase admin client not available');
    return;
  }
  
  // Get student data
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, first_name, last_name, email')
    .eq('id', studentId)
    .maybeSingle();
  
  if (studentError || !student) {
    console.error('[sync-customer] Failed to fetch student:', studentError);
    return;
  }
  
  // Get Stripe customer ID
  const { data: billing, error: billingError } = await supabaseAdmin
    .from('students_billing')
    .select('stripe_customer_id')
    .eq('student_id', studentId)
    .maybeSingle();
  
  if (billingError || !billing?.stripe_customer_id) {
    // No Stripe customer linked, skip
    return;
  }
  
  // Update Stripe customer
  try {
    await stripe.customers.update(billing.stripe_customer_id, {
      name: `${student.first_name} ${student.last_name}`.trim(),
      email: student.email || undefined,
    });
  } catch (stripeError: any) {
    console.error('[sync-customer] Failed to update Stripe customer:', stripeError?.message);
    // Don't throw - this is a background sync, shouldn't fail the main request
  }
}


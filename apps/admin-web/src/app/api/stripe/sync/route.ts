import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin staff
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Verify admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    const body = await request.json();
    const { studentId, stripeCustomerId } = body;

    if (!studentId || !stripeCustomerId) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, stripeCustomerId' },
        { status: 400 }
      );
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, email, first_name, last_name')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Fetch Stripe customer and payment methods
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted) {
      return NextResponse.json(
        { error: 'Stripe customer has been deleted' },
        { status: 400 }
      );
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    // Get Stripe's default payment method
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method as string | undefined;

    // Create or update students_billing record
    const { error: billingError } = await supabaseAdmin
      .from('students_billing')
      .upsert(
        {
          student_id: studentId,
          stripe_customer_id: stripeCustomerId,
        },
        {
          onConflict: 'student_id',
        }
      );

    if (billingError) {
      console.error('Error upserting students_billing:', billingError);
      return NextResponse.json(
        { error: 'Failed to update billing record: ' + billingError.message },
        { status: 500 }
      );
    }

    // Sync payment methods
    // First, identify which payment method should be default
    const defaultPmId = defaultPaymentMethodId || 
      (paymentMethods.data.length === 1 ? paymentMethods.data[0]?.id : null);

    // Unset all existing defaults before syncing
    if (defaultPmId) {
      await supabaseAdmin
        .from('student_payment_methods')
        .update({ is_default: false })
        .eq('student_id', studentId);
    }

    const syncedPaymentMethods: string[] = [];
    const errors: string[] = [];

    for (const pm of paymentMethods.data) {
      if (pm.type !== 'card' || !pm.card) {
        continue;
      }

      const isDefault = pm.id === defaultPmId;

      try {
        // Check if payment method already exists
        const { data: existing } = await supabaseAdmin
          .from('student_payment_methods')
          .select('id')
          .eq('stripe_payment_method_id', pm.id)
          .maybeSingle();

        if (existing) {
          // Update if it exists
          const { error: updateError } = await supabaseAdmin
            .from('student_payment_methods')
            .update({
              is_default: isDefault,
              card_brand: pm.card.brand,
              card_last4: pm.card.last4,
              card_exp_month: pm.card.exp_month,
              card_exp_year: pm.card.exp_year,
              card_country: pm.card.country || null,
            })
            .eq('id', existing.id);

          if (updateError) {
            errors.push(`Failed to update payment method ${pm.id}: ${updateError.message}`);
          } else {
            syncedPaymentMethods.push(pm.id);
          }
        } else {
          // Insert if it doesn't exist
          const { error: insertError } = await supabaseAdmin
            .from('student_payment_methods')
            .insert({
              student_id: studentId,
              stripe_payment_method_id: pm.id,
              is_default: isDefault,
              card_brand: pm.card.brand,
              card_last4: pm.card.last4,
              card_exp_month: pm.card.exp_month,
              card_exp_year: pm.card.exp_year,
              card_country: pm.card.country || null,
            });

          if (insertError) {
            errors.push(`Failed to insert payment method ${pm.id}: ${insertError.message}`);
          } else {
            syncedPaymentMethods.push(pm.id);
          }
        }
      } catch (err: any) {
        errors.push(`Error syncing payment method ${pm.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      syncedPaymentMethods,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error syncing Stripe customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Stripe customer' },
      { status: 500 }
    );
  }
}


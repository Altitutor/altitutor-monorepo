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
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
        { status: 400 }
      );
    }

    // Verify student exists and get billing info
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, email, first_name, last_name, students_billing(stripe_customer_id)')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const billing = Array.isArray(student.students_billing)
      ? student.students_billing[0]
      : student.students_billing;

    if (!billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Student is not linked to a Stripe customer' },
        { status: 400 }
      );
    }

    const stripeCustomerId = billing.stripe_customer_id;

    // Fetch Stripe customer
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted) {
      return NextResponse.json(
        { error: 'Stripe customer has been deleted' },
        { status: 400 }
      );
    }

    // Get student's default payment method from DB
    const { data: dbPaymentMethods, error: pmError } = await supabaseAdmin
      .from('student_payment_methods')
      .select('card_last4, is_default, stripe_payment_method_id')
      .eq('student_id', studentId)
      .order('is_default', { ascending: false });

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
      return NextResponse.json(
        { error: 'Failed to fetch payment methods: ' + pmError.message },
        { status: 500 }
      );
    }

    const defaultDbPaymentMethod = dbPaymentMethods?.find((pm) => pm.is_default);

    // Fetch Stripe payment methods
    const stripePaymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    // Prepare update data for Stripe customer
    const updateData: Stripe.CustomerUpdateParams = {};
    const updates: string[] = [];

    // Update name
    const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
    if (studentName && studentName !== customer.name) {
      updateData.name = studentName;
      updates.push('name');
    }

    // Update email
    if (student.email !== customer.email) {
      updateData.email = student.email || undefined;
      updates.push('email');
    }

    // Update Stripe customer if there are changes
    if (Object.keys(updateData).length > 0) {
      await stripe.customers.update(stripeCustomerId, updateData);
    }

    // Sync default payment method
    let defaultPmUpdated = false;
    if (defaultDbPaymentMethod?.card_last4) {
      // Find matching Stripe payment method by last4
      const matchingStripePm = stripePaymentMethods.data.find(
        (pm) => pm.card?.last4 === defaultDbPaymentMethod.card_last4
      );

      if (matchingStripePm) {
        // Check if this is already the default
        const currentDefaultPmId = customer.invoice_settings?.default_payment_method as string | undefined;
        if (currentDefaultPmId !== matchingStripePm.id) {
          // Update Stripe customer's default payment method
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: {
              default_payment_method: matchingStripePm.id,
            },
          });
          defaultPmUpdated = true;
          updates.push('default payment method');
        }
      }
    }

    return NextResponse.json({
      success: true,
      updates: updates.length > 0 ? updates : [],
      message: updates.length > 0
        ? `Synced ${updates.join(', ')} to Stripe`
        : 'No changes needed',
    });
  } catch (error: any) {
    console.error('Error syncing to Stripe:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync to Stripe' },
      { status: 500 }
    );
  }
}


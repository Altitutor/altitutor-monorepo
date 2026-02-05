import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';

/**
 * GET /api/students/[id]/customer-balance
 * Get customer balance for a student
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;

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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get billing info
    const { data: billing, error: billingError } = await supabaseAdmin
      .from('students_billing')
      .select('stripe_customer_id, customer_balance_cents, customer_balance_currency, customer_balance_updated_at')
      .eq('student_id', studentId)
      .maybeSingle();

    if (billingError) {
      return NextResponse.json(
        { error: 'Failed to fetch billing info' },
        { status: 500 }
      );
    }

    if (!billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Student is not linked to a Stripe customer' },
        { status: 404 }
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

    // Fetch current balance from Stripe
    const customerResponse = await stripe.customers.retrieve(billing.stripe_customer_id);
    if (customerResponse.deleted) {
      return NextResponse.json(
        { error: 'Stripe customer has been deleted' },
        { status: 400 }
      );
    }

    // Type guard: after checking deleted, we know it's a Customer
    const customer: Stripe.Customer = customerResponse as Stripe.Customer;
    const stripeBalance = customer.balance || 0;
    const currency = customer.currency || 'aud';

    // Update database with latest balance
    await supabaseAdmin
      .from('students_billing')
      .update({
        customer_balance_cents: stripeBalance,
        customer_balance_currency: currency.toLowerCase(),
        customer_balance_updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId);

    return NextResponse.json({
      balance_cents: stripeBalance,
      currency: currency.toLowerCase(),
      updated_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('[api/students/customer-balance] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students/[id]/customer-balance
 * Update customer balance (add credit or adjust balance)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;
    const body = await request.json();
    const { amount_cents, currency = 'aud', description } = body;

    if (typeof amount_cents !== 'number') {
      return NextResponse.json(
        { error: 'amount_cents is required and must be a number' },
        { status: 400 }
      );
    }

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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get billing info
    const { data: billing, error: billingError } = await supabaseAdmin
      .from('students_billing')
      .select('stripe_customer_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (billingError || !billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Student is not linked to a Stripe customer' },
        { status: 404 }
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

    // Update customer balance in Stripe
    // Stripe uses balance_transactions to adjust customer balance
    // Negative amount = credit (customer owes less), positive = debit (customer owes more)
    const balanceTransaction = await stripe.customers.createBalanceTransaction(
      billing.stripe_customer_id,
      {
        amount: amount_cents, // Negative for credit, positive for debit
        currency: currency.toLowerCase(),
        description: description || `Balance adjustment for student ${studentId}`,
      }
    );

    // Fetch updated customer to get new balance
    const customerResponse = await stripe.customers.retrieve(billing.stripe_customer_id);
    if (customerResponse.deleted) {
      return NextResponse.json(
        { error: 'Stripe customer has been deleted' },
        { status: 400 }
      );
    }

    // Type guard: after checking deleted, we know it's a Customer
    const customer: Stripe.Customer = customerResponse as Stripe.Customer;
    const newBalance = customer.balance || 0;

    // Update database
    await supabaseAdmin
      .from('students_billing')
      .update({
        customer_balance_cents: newBalance,
        customer_balance_currency: currency.toLowerCase(),
        customer_balance_updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId);

    return NextResponse.json({
      success: true,
      balance_cents: newBalance,
      currency: currency.toLowerCase(),
      balance_transaction_id: balanceTransaction.id,
      updated_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('[api/students/customer-balance] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

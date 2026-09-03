import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';

/**
 * GET /api/students/[id]/customer-balance
 * Get customer balance for a student
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const studentId = params.id;

    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

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
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get billing info to find Stripe customer ID
    const { data: billing, error: billingError } = await supabaseAdmin
      .from('students_billing')
      .select('stripe_customer_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (billingError) {
      return NextResponse.json({ error: 'Failed to fetch billing info' }, { status: 500 });
    }

    if (!billing?.stripe_customer_id) {
      return NextResponse.json({
        linked: false,
        balance_cents: 0,
        currency: 'aud',
        stripe_customer_id: null,
        updated_at: new Date().toISOString(),
      });
    }

    // Get Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    });

    // Fetch current balance from Stripe (single source of truth)
    const customerResponse = await stripe.customers.retrieve(billing.stripe_customer_id);
    if (customerResponse.deleted) {
      return NextResponse.json({ error: 'Stripe customer has been deleted' }, { status: 400 });
    }

    // Type guard: after checking deleted, we know it's a Customer
    const customer: Stripe.Customer = customerResponse as Stripe.Customer;
    const stripeBalance = customer.balance || 0;
    const currency = customer.currency || 'aud';

    return NextResponse.json({
      balance_cents: stripeBalance,
      currency: currency.toLowerCase(),
      updated_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    captureApiError(error, '/api/students/[id]/customer-balance');
    console.error('[api/students/customer-balance] Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

/**
 * POST /api/students/[id]/customer-balance
 * Update customer balance (add credit or adjust balance)
 */
export async function POST(_request: NextRequest, { params: _params }: { params: { id: string } }) {
  return NextResponse.json(
    {
      error: 'Direct balance adjustments are disabled. Issue a credit note against an invoice instead.',
    },
    { status: 410 },
  );
}

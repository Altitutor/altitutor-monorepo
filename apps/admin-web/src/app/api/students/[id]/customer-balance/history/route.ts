import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';

/**
 * GET /api/students/[id]/customer-balance/history
 * Get customer balance transaction history from Stripe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const startingAfter = searchParams.get('starting_after') || undefined;

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

    // Get billing info to find Stripe customer ID
    const { data: billing, error: billingError } = await supabaseAdmin
      .from('students_billing')
      .select('stripe_customer_id')
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

    // Fetch balance transactions from Stripe
    const balanceTransactions = await stripe.customers.listBalanceTransactions(
      billing.stripe_customer_id,
      {
        limit: Math.min(limit, 100), // Stripe max is 100
        starting_after: startingAfter,
        expand: ['data.invoice', 'data.credit_note'],
      }
    );

    // Transform transactions to a cleaner format
    const transactions = balanceTransactions.data.map((tx) => ({
      id: tx.id,
      amount_cents: tx.amount,
      currency: tx.currency,
      type: tx.type,
      description: tx.description,
      created: tx.created,
      ending_balance: tx.ending_balance,
      invoice_id: typeof tx.invoice === 'string' ? tx.invoice : tx.invoice?.id || null,
      credit_note_id: typeof tx.credit_note === 'string' ? tx.credit_note : tx.credit_note?.id || null,
      metadata: tx.metadata,
    }));

    return NextResponse.json({
      transactions,
      has_more: balanceTransactions.has_more,
      // Return the last transaction ID for pagination
      last_transaction_id: transactions.length > 0 ? transactions[transactions.length - 1].id : null,
    });
  } catch (error: unknown) {
    console.error('[api/students/customer-balance/history] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

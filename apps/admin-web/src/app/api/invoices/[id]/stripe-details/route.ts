import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;

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

    // Get invoice from database
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('stripe_invoice_id')
      .eq('id', invoiceId)
      .single<{ stripe_invoice_id: string | null }>();

    if (invoiceError || !invoice || !invoice.stripe_invoice_id) {
      return NextResponse.json({ error: 'Invoice not found or has no Stripe invoice ID' }, { status: 404 });
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

    // Fetch invoice details from Stripe
    const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);

    const lastPaymentError = (stripeInvoice as any).last_payment_error;

    return NextResponse.json({
      next_payment_attempt: stripeInvoice.next_payment_attempt,
      attempt_count: stripeInvoice.attempt_count,
      last_payment_error: lastPaymentError ? {
        code: lastPaymentError.code || 'unknown',
        message: lastPaymentError.message || 'Unknown error',
        type: lastPaymentError.type || 'card_error',
      } : null,
      auto_retry_active: stripeInvoice.next_payment_attempt !== null,
    });
  } catch (error) {
    console.error('[api/invoices/stripe-details] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

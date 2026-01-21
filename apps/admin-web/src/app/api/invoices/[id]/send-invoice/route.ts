import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';

export async function POST(
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
      .select('stripe_invoice_id, collection_method')
      .eq('id', invoiceId)
      .single<{ stripe_invoice_id: string | null; collection_method: string | null }>();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.collection_method !== 'send_invoice') {
      return NextResponse.json(
        { error: 'Invoice is not a send_invoice type. Use charge card instead.' },
        { status: 400 }
      );
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json({ error: 'Invoice has no Stripe invoice ID' }, { status: 400 });
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

    // Send invoice email
    const sentInvoice = await stripe.invoices.sendInvoice(invoice.stripe_invoice_id);

    return NextResponse.json({
      success: true,
      invoice: {
        id: sentInvoice.id,
        status: sentInvoice.status,
      },
    });
  } catch (error) {
    console.error('[api/invoices/send-invoice] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

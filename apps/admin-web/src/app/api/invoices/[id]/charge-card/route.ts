import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage, getStripeErrorDetails } from '@/shared/utils';
import { recordInvoiceOperatorEvent } from '@/features/billing/lib/recordInvoiceOperatorEvent';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoiceId = params.id;
  let actorStaffId: string | null = null;
  let studentId: string | null = null;

  try {
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, role, status')
      .eq('user_id', session.user.id)
      .single<{ id: string; role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    actorStaffId = staffData.id;

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('stripe_invoice_id, collection_method, student_id')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .single<{ stripe_invoice_id: string | null; collection_method: string | null; student_id: string }>();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    studentId = invoice.student_id;

    if (invoice.collection_method !== 'charge_automatically') {
      return NextResponse.json(
        { error: 'Invoice is not a charge_automatically type. Use send invoice instead.' },
        { status: 400 }
      );
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json({ error: 'Invoice has no Stripe invoice ID' }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });
    const paidInvoice = await stripe.invoices.pay(invoice.stripe_invoice_id);

    await recordInvoiceOperatorEvent({
      invoiceId,
      studentId,
      eventName: 'invoice.payment_attempted',
      actorStaffId,
      payload: {
        outcome: 'succeeded',
        stripe_status: paidInvoice.status ?? undefined,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: paidInvoice.id,
        status: paidInvoice.status,
      },
    });
  } catch (error: unknown) {
    const stripeDetails = getStripeErrorDetails(error);
    if (stripeDetails.type === 'StripeCardError' && stripeDetails.statusCode === 402) {
      if (actorStaffId) {
        await recordInvoiceOperatorEvent({
          invoiceId,
          studentId,
          eventName: 'invoice.payment_attempted',
          actorStaffId,
          payload: {
            outcome: 'declined',
            error_code: stripeDetails.code ?? undefined,
          },
        });
      }

      return NextResponse.json(
        {
          error: getErrorMessage(error),
          code: stripeDetails.code,
        },
        { status: 402 },
      );
    }

    captureApiError(error, "/api/invoices/[id]/charge-card");
    console.error('[api/invoices/charge-card] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

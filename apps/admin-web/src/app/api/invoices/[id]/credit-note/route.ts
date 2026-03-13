import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';
import { z } from 'zod';

const creditNoteLineSchema = z.object({
  stripeInvoiceItemId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  amount_cents: z.number().int().nonnegative().optional(),
}).refine((data) => data.quantity !== undefined || data.amount_cents !== undefined, {
  message: 'Either quantity or amount_cents must be provided',
});

const creditNoteBodySchema = z.object({
  reason: z.enum(['duplicate', 'product_unsatisfactory', 'order_change', 'fraudulent', 'other']),
  lines: z.array(creditNoteLineSchema).min(1, 'At least one line must be credited'),
  memo: z.string().max(500).optional(),
  effective_at: z.string().datetime().optional(),
  refund_amount_cents: z.number().int().nonnegative().optional(),
  credit_amount_cents: z.number().int().nonnegative().optional(),
  out_of_band_amount_cents: z.number().int().nonnegative().optional(),
  email_type: z.enum(['credit_note', 'none']).optional(),
  internal_note: z.string().max(500).optional(),
}).refine(
  (data) => {
    const count = [
      data.refund_amount_cents !== undefined && data.refund_amount_cents > 0,
      data.credit_amount_cents !== undefined && data.credit_amount_cents > 0,
      data.out_of_band_amount_cents !== undefined && data.out_of_band_amount_cents > 0,
    ].filter(Boolean).length;
    return count <= 1;
  },
  { message: 'Only one of refund_amount_cents, credit_amount_cents, or out_of_band_amount_cents may be set' }
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;

    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('stripe_invoice_id, status')
      .eq('id', invoiceId)
      .single<{ stripe_invoice_id: string | null; status: string | null }>();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json({ error: 'Invoice has no Stripe invoice ID' }, { status: 400 });
    }

    const allowedStatuses = ['open', 'paid'];
    if (!invoice.status || !allowedStatuses.includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Credit notes can only be issued for open or paid invoices' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = creditNoteBodySchema.safeParse(body);
    if (!parseResult.success) {
      const message = parseResult.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const {
      reason,
      lines,
      memo,
      effective_at,
      refund_amount_cents,
      credit_amount_cents,
      out_of_band_amount_cents,
      email_type,
      internal_note,
    } = parseResult.data;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    // Stripe Credit Notes API requires invoice LINE item ids (il_xxx), not invoice item ids (ii_xxx).
    // Our DB stores ii_xxx (stripe_invoice_item_id). Fetch current invoice lines and map ii_xxx -> il_xxx.
    const stripeLineItems = await stripe.invoices.listLineItems(invoice.stripe_invoice_id, { limit: 100 });
    const invoiceItemIdToLineItemId = new Map<string, string>();
    for (const item of stripeLineItems.data) {
      const parent = item.parent as {
        invoice_item_details?: { invoice_item?: string };
        subscription_item_details?: { invoice_item?: string };
      } | null;
      const iiId = parent?.invoice_item_details?.invoice_item ?? parent?.subscription_item_details?.invoice_item;
      if (iiId && item.id) {
        invoiceItemIdToLineItemId.set(iiId, item.id);
      }
      // Also map by line item id so il_xxx from client is passed through
      if (item.id) {
        invoiceItemIdToLineItemId.set(item.id, item.id);
      }
    }

    const stripeReason = reason === 'other' ? undefined : reason;
    const stripeLines: Array<{ type: 'invoice_line_item'; invoice_line_item: string; amount?: number; quantity?: number }> = [];

    for (const l of lines) {
      const lineItemId = invoiceItemIdToLineItemId.get(l.stripeInvoiceItemId);
      if (!lineItemId) {
        return NextResponse.json(
          {
            error: `Could not find current Stripe line item for invoice item ${l.stripeInvoiceItemId}. The invoice may have changed; try refreshing.`,
          },
          { status: 400 }
        );
      }
      const hasAmount = l.amount_cents !== undefined && l.amount_cents > 0;
      const hasQty = l.quantity !== undefined && l.quantity > 0;
      stripeLines.push({
        type: 'invoice_line_item',
        invoice_line_item: lineItemId,
        ...(hasAmount ? { amount: l.amount_cents } : { quantity: hasQty ? l.quantity : 1 }),
      });
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') ?? `credit-note-${invoiceId}-${Date.now()}`;

    const createParams: Stripe.CreditNoteCreateParams = {
      invoice: invoice.stripe_invoice_id,
      lines: stripeLines,
      ...(stripeReason && { reason: stripeReason }),
      ...(memo && { memo }),
      ...(effective_at && { effective_at: Math.floor(new Date(effective_at).getTime() / 1000) }),
      ...(refund_amount_cents !== undefined && refund_amount_cents > 0 && { refund_amount: refund_amount_cents }),
      ...(credit_amount_cents !== undefined && credit_amount_cents > 0 && { credit_amount: credit_amount_cents }),
      ...(out_of_band_amount_cents !== undefined && out_of_band_amount_cents > 0 && { out_of_band_amount: out_of_band_amount_cents }),
      ...(email_type && { email_type }),
      ...(internal_note && { metadata: { internal_note } }),
    };

    const creditNote = await stripe.creditNotes.create(createParams, { idempotencyKey });

    // Do not write to local credit_notes here; webhooks are the single source of truth.
    // The stripe-webhooks edge function will upsert credit_notes and update invoices.has_credit_notes.

    return NextResponse.json({
      creditNoteId: creditNote.id,
      stripeCreditNoteId: creditNote.id,
    });
  } catch (error) {
    console.error('[api/invoices/credit-note] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

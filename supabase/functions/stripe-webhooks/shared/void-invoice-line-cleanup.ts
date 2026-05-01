import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Remove mirrored `invoice_items` for a voided Stripe invoice.
 * Stripe keeps the void invoice and its lines; this releases `sessions_students_id`
 * unique slots so a session can be re-invoiced.
 */
export async function deleteInvoiceItemsForVoidedStripeInvoice(
  supabase: SupabaseClient,
  stripeInvoiceId: string
): Promise<{ error: Error | null }> {
  const { data: inv, error: selErr } = await supabase
    .from('invoices')
    .select('id')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .maybeSingle();

  if (selErr) {
    console.error('[webhook] void invoice cleanup: lookup failed', selErr);
    return { error: new Error(selErr.message) };
  }
  if (!inv?.id) {
    return { error: null };
  }

  const { error: delErr } = await supabase.from('invoice_items').delete().eq('invoice_id', inv.id);

  if (delErr) {
    console.error('[webhook] void invoice cleanup: delete invoice_items failed', delErr);
    return { error: new Error(delErr.message) };
  }

  return { error: null };
}

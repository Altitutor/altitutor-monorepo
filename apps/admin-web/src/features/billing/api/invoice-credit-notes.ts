import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceStatusPayload } from '../utils/invoiceFormatters';

/** Load actual financial adjustments once for all invoices on a session surface. */
export async function getInvoiceCreditNotesByInvoiceIds(
  supabase: SupabaseClient<Database>,
  invoiceIds: string[],
): Promise<Record<string, NonNullable<InvoiceStatusPayload['credit_notes']>>> {
  const uniqueIds = [...new Set(invoiceIds)];
  if (uniqueIds.length === 0) return {};
  const notesByInvoice: Record<
    string,
    NonNullable<InvoiceStatusPayload['credit_notes']>
  > = {};
  // Keep each PostgREST URL bounded when a session table covers thousands of invoices.
  for (let offset = 0; offset < uniqueIds.length; offset += 400) {
    const group = uniqueIds.slice(offset, offset + 400);
    const batches = [];
    for (let index = 0; index < group.length; index += 100) {
      batches.push(group.slice(index, index + 100));
    }
    const results = await Promise.all(
      batches.map((ids) =>
        supabase
          .from('credit_notes')
          .select(
            'invoice_id, status, amount_cents, refund_amount_cents, credit_amount_cents, out_of_band_amount_cents, created_at',
          )
          .in('invoice_id', ids)
          .order('created_at', { ascending: false }),
      ),
    );
    for (const { data, error } of results) {
      if (error) throw error;
      for (const note of data ?? []) {
        if (note.status === 'void') continue;
        (notesByInvoice[note.invoice_id] ??= []).push(note);
      }
    }
  }
  return notesByInvoice;
}

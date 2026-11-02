import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface InvoiceOwing {
  currency: string;
  amountCents: number;
}

export async function getStudentInvoiceOwing(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<InvoiceOwing[]> {
  const totals = new Map<string, number>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('invoices')
      .select('id, currency, amount_due_cents, amount_paid_cents')
      .eq('student_id', studentId)
      .eq('status', 'open')
      .is('deleted_at', null)
      .not('finalized_at', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const invoice of data ?? []) {
      const currency = invoice.currency.toUpperCase();
      totals.set(currency, (totals.get(currency) ?? 0) + invoice.amount_due_cents - invoice.amount_paid_cents);
    }
    if (!data || data.length < pageSize) break;
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amountCents]) => ({ currency, amountCents }));
}

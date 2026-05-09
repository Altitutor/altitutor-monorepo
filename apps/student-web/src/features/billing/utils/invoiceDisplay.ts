export function formatAmount(cents: number | null): string {
  if (cents === null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
}

export function getAdelaideTodayIsoDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

export function isInvoiceOverdue(invoice: {
  status: string | null;
  paid_at: string | null;
  invoice_date: string | null;
}): boolean {
  if (invoice.status !== 'open') return false;
  if (invoice.paid_at) return false;
  if (!invoice.invoice_date) return false;
  const todayAdelaide = getAdelaideTodayIsoDate();
  if (!todayAdelaide) return false;
  return invoice.invoice_date < todayAdelaide;
}

export function getInvoiceTotalAmount(invoice: {
  total_charges_cents: number | null;
  total_subsidies_cents: number | null;
  amount_due_cents: number | null;
}): number | null {
  if (invoice.total_charges_cents != null) {
    const subsidies = invoice.total_subsidies_cents ?? 0;
    return invoice.total_charges_cents - subsidies;
  }
  return invoice.amount_due_cents;
}

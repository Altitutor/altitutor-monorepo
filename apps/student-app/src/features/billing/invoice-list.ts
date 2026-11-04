type InvoiceListItem = {
  description: string | null;
  subject_name: string | null;
  is_subsidy: boolean | null;
};

export function invoiceListTitle(invoice: { stripe_invoice_number: string | null }): string {
  return invoice.stripe_invoice_number?.trim() || 'Invoice';
}

export function invoiceListSubtitle(items: InvoiceListItem[]): string {
  const labels = items
    .filter((item) => !item.is_subsidy)
    .map((item) => item.description?.trim() || item.subject_name?.trim() || 'Line item');
  return labels.length > 0 ? labels.join(', ') : 'No line items';
}

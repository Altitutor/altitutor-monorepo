type InvoiceTagTextOptions = {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  lineItemDescriptions?: string[];
  status?: string | null;
};

/** Stripe's invoice number is the canonical human-readable invoice name. */
export function formatInvoiceTagText({ invoiceNumber }: InvoiceTagTextOptions): string {
  return invoiceNumber?.trim() || 'Invoice';
}

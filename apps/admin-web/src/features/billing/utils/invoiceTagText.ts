import { format } from 'date-fns';

type InvoiceTagTextOptions = {
  invoiceDate: string | null;
  lineItemDescriptions: string[];
  status: string | null;
};

/**
 * Format invoice tag text for task/issue mentions.
 * Example: 2026-02-19 INVOICE for Session fee, Materials PAID
 */
export function formatInvoiceTagText({
  invoiceDate,
  lineItemDescriptions,
  status,
}: InvoiceTagTextOptions): string {
  const parsedDate = invoiceDate ? new Date(invoiceDate) : null;
  const formattedDate =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? format(parsedDate, 'yyyy-MM-dd')
      : 'unknown-date';
  const lineItemsText = lineItemDescriptions.filter(Boolean).join(', ') || 'No line items';
  const formattedStatus = (status || 'unknown').toUpperCase();
  return `${formattedDate} INVOICE for ${lineItemsText} ${formattedStatus}`;
}

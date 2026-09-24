import Stripe from 'npm:stripe@16.6.0';
import {
  buildInvoiceNotificationEmail,
  deliverEdgeEmail,
} from '../../_shared/email.generated.ts';

/**
 * Send invoice email to recipients based on billing preferences
 * Uses Resend instead of Stripe's built-in email system for better control
 */
export async function sendInvoiceEmail(
  stripe: Stripe,
  invoiceId: string,
  studentId: string,
  invoiceEmailToStudent: boolean,
  invoiceEmailToParents: boolean,
  studentEmail: string | undefined,
  parentEmails: string[],
  resendApiKey: string
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];

  // Fetch invoice details from Stripe to get hosted URL and PDF
  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(invoiceId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[invoice-email] Failed to retrieve invoice ${invoiceId}:`, msg);
    return { sent: [], failed: [] };
  }

  // Build recipient list based on preferences
  const recipients: string[] = [];
  
  if (invoiceEmailToStudent && studentEmail) {
    recipients.push(studentEmail);
  }
  
  if (invoiceEmailToParents && parentEmails.length > 0) {
    for (const email of parentEmails) {
      if (email && !recipients.includes(email)) {
        recipients.push(email);
      }
    }
  }

  if (recipients.length === 0) {
    console.warn(`[invoice-email] No recipients configured for invoice ${invoiceId} (student: ${invoiceEmailToStudent}, parents: ${invoiceEmailToParents})`);
    return { sent: [], failed: [] };
  }

  // Format invoice amount
  const amount = invoice.total ? (invoice.total / 100).toFixed(2) : '0.00';
  const currency = invoice.currency?.toUpperCase() || 'AUD';
  const invoiceNumber = invoice.number || invoiceId.slice(0, 8);
  const invoiceDate = invoice.created ? new Date(invoice.created * 1000).toISOString() : 'N/A';
  const dueDate = invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : 'N/A';
  const paid = invoice.status === 'paid';

  let lineItems: Array<{ description: string; amount: string }> = [];
  try {
    const lines = await stripe.invoices.listLineItems(invoiceId, { limit: 100 });
    lineItems = lines.data.map((line) => ({
      description: line.description || 'Invoice item',
      amount: `${currency} $${(line.amount / 100).toFixed(2)}`,
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[invoice-email] Failed to list line items for invoice ${invoiceId}:`, msg);
  }

  const hostedInvoiceUrl = invoice.hosted_invoice_url || '';
  const invoicePdfUrl = invoice.invoice_pdf || '';
  const email = buildInvoiceNotificationEmail({
    invoiceNumber,
    invoiceDate,
    dueDate,
    amount: `${currency} $${amount}`,
    paid,
    lineItems,
    hostedInvoiceUrl: hostedInvoiceUrl || undefined,
    invoicePdfUrl: invoicePdfUrl || undefined,
  });

  for (const recipient of recipients) {
    try {
      await deliverEdgeEmail({
        apiKey: resendApiKey,
        to: recipient,
        email,
        idempotencyKey: `core-invoice/${invoiceId}/${recipient}`,
      });
      sent.push(recipient);
      console.log(`[invoice-email] Sent invoice ${invoiceId} to ${recipient}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[invoice-email] Failed to send invoice ${invoiceId} to ${recipient}:`, msg);
      failed.push(recipient);
    }
  }

  return { sent, failed };
}

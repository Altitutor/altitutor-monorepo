import Stripe from 'npm:stripe@16.6.0';
import { Resend } from 'npm:resend@4.0.0';

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
  const invoiceDate = invoice.created ? new Date(invoice.created * 1000).toLocaleDateString() : 'N/A';
  const dueDate = invoice.due_date ? new Date(invoice.due_date * 1000).toLocaleDateString() : 'N/A';

  // Build email HTML
  const hostedInvoiceUrl = invoice.hosted_invoice_url || '';
  const invoicePdfUrl = invoice.invoice_pdf || '';

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceNumber} - Altitutor</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #0a2941 0%, #144e72 100%); border-radius: 8px 8px 0 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Altitutor</h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: 600;">Invoice ${invoiceNumber}</h2>
                  
                  <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
                    Thank you for your business. Please find your invoice details below.
                  </p>
                  
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280; font-size: 14px;">Invoice Date:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 500; margin-left: 8px;">${invoiceDate}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280; font-size: 14px;">Due Date:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 500; margin-left: 8px;">${dueDate}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #6b7280; font-size: 14px;">Total Amount:</span>
                        <span style="color: #111827; font-size: 18px; font-weight: 600; margin-left: 8px;">${currency} $${amount}</span>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="margin: 30px 0;">
                    ${hostedInvoiceUrl ? `
                      <a href="${hostedInvoiceUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0a2941; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 12px;">
                        View Invoice Online
                      </a>
                    ` : ''}
                    ${invoicePdfUrl ? `
                      <a href="${invoicePdfUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #0a2941; text-decoration: none; border-radius: 6px; font-weight: 500; border: 1px solid #0a2941;">
                        Download PDF
                      </a>
                    ` : ''}
                  </div>
                  
                  <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                    If you have any questions about this invoice, please contact us at <a href="mailto:support@altitutor.com" style="color: #0a2941;">support@altitutor.com</a>.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} Altitutor. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Send emails using Resend
  const resend = new Resend(resendApiKey);

  for (const recipient of recipients) {
    try {
      await resend.emails.send({
        from: 'Altitutor <noreply@altitutor.com>',
        to: recipient,
        subject: `Invoice ${invoiceNumber} - Altitutor`,
        html: emailHtml,
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

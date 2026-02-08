import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';
import { sendEmail } from '@/shared/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;

    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin staff
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get invoice from database with student_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('stripe_invoice_id, collection_method, student_id')
      .eq('id', invoiceId)
      .single<{ stripe_invoice_id: string | null; collection_method: string | null; student_id: string }>();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.collection_method !== 'send_invoice') {
      return NextResponse.json(
        { error: 'Invoice is not a send_invoice type. Use charge card instead.' },
        { status: 400 }
      );
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json({ error: 'Invoice has no Stripe invoice ID' }, { status: 400 });
    }

    // Get Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // Check Resend API key
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    // Fetch invoice details from Stripe
    const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);

    // Get billing preferences
    const { data: billingPrefs } = await supabase
      .from('students_billing')
      .select('invoice_email_to_student, invoice_email_to_parents')
      .eq('student_id', invoice.student_id)
      .maybeSingle<{ invoice_email_to_student: boolean | null; invoice_email_to_parents: boolean | null }>();

    const invoiceEmailToStudent = billingPrefs?.invoice_email_to_student ?? true;
    const invoiceEmailToParents = billingPrefs?.invoice_email_to_parents ?? true;

    // Get student email
    const { data: student } = await supabase
      .from('students')
      .select('email')
      .eq('id', invoice.student_id)
      .single<{ email: string | null }>();

    const studentEmail = student?.email || undefined;

    // Get parent emails
    const { data: parentsData } = await supabase
      .from('parents_students')
      .select('student_id, parent:parents(id, email)')
      .eq('student_id', invoice.student_id);

    const parentEmails: string[] = [];
    if (parentsData) {
      for (const row of parentsData as any[]) {
        const email = row.parent?.email as string | undefined;
        if (email && !parentEmails.includes(email)) {
          parentEmails.push(email);
        }
      }
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
      return NextResponse.json(
        { error: 'No email recipients configured. Please check billing preferences.' },
        { status: 400 }
      );
    }

    // Format invoice details
    const amount = stripeInvoice.total ? (stripeInvoice.total / 100).toFixed(2) : '0.00';
    const currency = stripeInvoice.currency?.toUpperCase() || 'AUD';
    const invoiceNumber = stripeInvoice.number || invoiceId.slice(0, 8);
    const invoiceDate = stripeInvoice.created ? new Date(stripeInvoice.created * 1000).toLocaleDateString() : 'N/A';
    const dueDate = stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toLocaleDateString() : 'N/A';
    const hostedInvoiceUrl = stripeInvoice.hosted_invoice_url || '';
    const invoicePdfUrl = stripeInvoice.invoice_pdf || '';

    // Build email HTML (same as billing runner)
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

    // Send emails to all recipients
    const sent: string[] = [];
    const failed: string[] = [];

    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient,
          subject: `Invoice ${invoiceNumber} - Altitutor`,
          html: emailHtml,
        });
        sent.push(recipient);
      } catch (err) {
        console.error(`[api/invoices/send-invoice] Failed to send to ${recipient}:`, err);
        failed.push(recipient);
      }
    }

    if (failed.length > 0 && sent.length === 0) {
      return NextResponse.json(
        { error: `Failed to send invoice email to all recipients: ${failed.join(', ')}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sent,
      failed: failed.length > 0 ? failed : undefined,
      message: `Invoice email sent to ${sent.length} recipient(s)${failed.length > 0 ? `, failed for ${failed.length} recipient(s)` : ''}`,
    });
  } catch (error) {
    console.error('[api/invoices/send-invoice] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
